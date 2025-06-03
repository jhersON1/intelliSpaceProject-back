import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { Repository } from 'typeorm';
import { Vendor } from '../auth/entities/vendor.entity';
import { Category } from '../categories/entities/category.entity';
import { PaginationDto } from '../common/dtos/pagination.dto';
import { AnalyticsService } from '../analytics/services/analytics.service';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Vendor)
    private readonly vendorRepository: Repository<Vendor>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async create(userId: string, createProductDto: CreateProductDto) {
    try {
      const vendor = await this.vendorRepository.findOne({
        where: { id: userId },
      });

      if (!vendor) {
        throw new BadRequestException('El usuario no es un vendedor válido');
      }

      // Buscar y validar la categoría
      const categoryId = Array.isArray(createProductDto.idCategory) 
        ? createProductDto.idCategory[0] 
        : createProductDto.idCategory;
        
      const category = await this.categoryRepository.findOne({
        where: { id: categoryId },
      });

      if (!category) {
        throw new BadRequestException(
          `La categoría con ID: ${categoryId} no existe`,
        );
      }

      // Crear el producto con vendor y categoría
      const product = this.productRepository.create({
        ...createProductDto,
        vendor: vendor,
        categories: [category],
      });

      const savedProduct = await this.productRepository.save(product);

      const { vendor: _, ...productDelVendor } = savedProduct;

      return productDelVendor;
    } catch (error) {
      this.handleExceptions(error);
    }
  }

  async findAll(paginationDto: PaginationDto) {
    const { limit = 10, offset = 0 } = paginationDto;
    const products = await this.productRepository.find({
      take: limit,
      skip: offset,
      relations: ['categories'], // Incluir las categorías en la respuesta
    });
    return products;
  }

  async findAllWithQueuePriority(paginationDto: PaginationDto) {
    const { limit = 10, offset = 0 } = paginationDto;
    
    // Búsqueda inteligente: productos ordenados por factor de utilización y disponibilidad
    const products = await this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.categories', 'categories')
      .leftJoinAndSelect('product.analytics', 'analytics')
      .where('product.stock > 0') // Solo productos disponibles
      .orderBy('analytics.utilizationFactor', 'DESC') // Priorizar productos con mayor demanda relativa
      .addOrderBy('product.stock', 'ASC') // Productos con poco stock primero
      .addOrderBy('product.datePublication', 'DESC') // Productos más nuevos
      .take(limit)
      .skip(offset)
      .getMany();

    return products;
  }

  async findAllProductsVendor(id: string, paginationDto: PaginationDto) {
    const { limit = 10, offset = 0 } = paginationDto;
    const products = await this.productRepository.find({
      take: limit,
      skip: offset,
      where: {
        vendor: { id },
      },
      relations: ['categories'], // Incluir las categorías en la respuesta
    });
    return products;
  }

  async findOne(id: string) {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['categories', 'vendor'], // Incluir categorías y vendor
    });

    if (!product) {
      throw new NotFoundException(`Producto con ID: ${id} no encontrado`);
    }

    return product;
  }

  async update(
    idVendor: string,
    idProduct: string,
    updateProductDto: UpdateProductDto,
  ) {
    const product = await this.productRepository.findOne({
      where: {
        id: idProduct,
        vendor: { id: idVendor },
      },
    });

    if (!product) {
      throw new NotFoundException(
        `Producto con ID: ${idProduct} no encontrado o no pertenece a este vendedor`,
      );
    }

    // Guardar stock anterior para tracking
    const previousStock = product.stock;

    // Si se está actualizando la categoría, validarla
    let category;
    if (updateProductDto.idCategory) {
      const categoryId = Array.isArray(updateProductDto.idCategory) 
        ? updateProductDto.idCategory[0] 
        : updateProductDto.idCategory;
        
      category = await this.categoryRepository.findOne({
        where: { id: categoryId },
      });

      if (!category) {
        throw new BadRequestException(
          `La categoría con ID: ${categoryId} no existe`,
        );
      }
    }

    const updatedProduct = await this.productRepository.preload({
      id: idProduct,
      ...updateProductDto,
      categories: category ? [category] : product.categories,
    });

    if (!updatedProduct) {
      throw new NotFoundException(
        `Producto con ID: ${idProduct} no encontrado después de preload`,
      );
    }

    await this.productRepository.save(updatedProduct);

    // Tracking de cambio de stock
    const newStock = updateProductDto.stock !== undefined ? updateProductDto.stock : previousStock;
    if (newStock !== previousStock) {
      await this.trackStockChange(idProduct, previousStock, newStock);
    }

    const { vendor, ...result } = updatedProduct;
    console.log(updateProductDto);

    return result;
  }

  private async trackStockChange(productId: string, previousStock: number, newStock: number) {
    try {
      let changeType: 'REPOSITION' | 'SALE' | 'ADJUSTMENT' | 'DEPLETION';
      
      if (newStock > previousStock) {
        changeType = 'REPOSITION'; // Aumento de stock
      } else if (newStock === 0) {
        changeType = 'DEPLETION'; // Stock agotado
      } else if (newStock < previousStock) {
        changeType = 'SALE'; // Disminución por venta
      } else {
        changeType = 'ADJUSTMENT'; // Ajuste manual
      }

      await this.analyticsService.trackStockChange({
        productId,
        previousStock,
        newStock,
        changeType,
        notes: `Cambio automático de stock: ${previousStock} → ${newStock}`
      });
    } catch (error) {
      console.error('Error en tracking de stock:', error);
      // No fallar la operación principal por errores de tracking
    }
  }

  async remove(id: string) {
    const product = await this.productRepository.findOne({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException(`Producto con ID: ${id} no encontrado`);
    }

    const deletedProduct = { ...product };

    await this.productRepository.remove(product);

    const { title } = deletedProduct;

    return { message: `Producto ${title} eliminado con exito` };
  }

  private handleExceptions(error: any) {
    if (error.code === '23505') {
      throw new BadRequestException(error.detail);
    }

    console.log(error);

    throw new InternalServerErrorException(
      'Error inesperado, revisar logs del servidor',
    );
  }
}
