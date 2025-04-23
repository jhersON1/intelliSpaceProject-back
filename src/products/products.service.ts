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
import { PaginationDto } from '../common/dtos/pagination.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Vendor)
    private readonly vendorRepository: Repository<Vendor>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async create(userId: string, createProductDto: CreateProductDto) {
    try {
      const vendor = await this.vendorRepository.findOne({
        where: { id: userId },
      });

      if (!vendor) {
        throw new BadRequestException('El usuario no es un vendedor válido');
      }

      const product = this.productRepository.create({
        ...createProductDto,
        vendor: vendor,
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
    });
    return products;
  }

  async findAllProductsVendor(id: string, paginationDto: PaginationDto) {
    // Buscar todos los productos donde el vendor.id coincida con el id proporcionado
    const { limit = 10, offset = 0 } = paginationDto;
    const products = await this.productRepository.find({
      take: limit,
      skip: offset,
      where: {
        vendor: { id },
      },
    });
    return products;
  }

  async findOne(id: string) {
    const product = await this.productRepository.findOne({
      where: { id },
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

    const updatedProduct = await this.productRepository.preload({
      id: idProduct,
      ...updateProductDto,
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

    const { titulo } = deletedProduct;

    return { message: `Producto ${titulo} eliminado con exito` };
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
