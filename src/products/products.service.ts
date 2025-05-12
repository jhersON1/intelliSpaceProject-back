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

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Vendor)
    private readonly vendorRepository: Repository<Vendor>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
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
      const category = await this.categoryRepository.findOne({
        where: { id: createProductDto.idCategory },
      });

      if (!category) {
        throw new BadRequestException(
          `La categoría con ID: ${createProductDto.idCategory} no existe`,
        );
      }

      // Crear el producto con vendor y categoría
      const product = this.productRepository.create({
        ...createProductDto,
        vendor: vendor,
        category: category,
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
      relations: ['category'], // Incluir la categoría en la respuesta
    });
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
      relations: ['category'], // Incluir la categoría en la respuesta
    });
    return products;
  }

  async findOne(id: string) {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['category', 'vendor'], // Incluir categoría y vendor
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

    // Si se está actualizando la categoría, validarla
    let category;
    if (updateProductDto.idCategory) {
      category = await this.categoryRepository.findOne({
        where: { id: updateProductDto.idCategory },
      });

      if (!category) {
        throw new BadRequestException(
          `La categoría con ID: ${updateProductDto.idCategory} no existe`,
        );
      }
    }

    const updatedProduct = await this.productRepository.preload({
      id: idProduct,
      ...updateProductDto,
      category: category || product.category, // Mantener la categoría actual si no se actualiza
    });

    if (!updatedProduct) {
      throw new NotFoundException(
        `Producto con ID: ${idProduct} no encontrado después de preload`,
      );
    }

    await this.productRepository.save(updatedProduct);

    const { vendor, ...result } = updatedProduct;
    console.log(updateProductDto);

    return result;
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
