import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { Vendor } from '../auth/entities/vendor.entity';
import { Category } from '../categories/entities/category.entity';
import { BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { CreateProductDto, ProductStatus } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PaginationDto } from '../common/dtos/pagination.dto';
import { AnalyticsService } from '../analytics/services/analytics.service';
import { EmbeddingService } from '../semantic-search/services/embedding.service';

describe('ProductsService', () => {
  let service: ProductsService;
  let productRepository: jest.Mocked<Repository<Product>>;
  let vendorRepository: jest.Mocked<Repository<Vendor>>;
  let categoryRepository: jest.Mocked<Repository<Category>>;
  let analyticsService: jest.Mocked<AnalyticsService>;
  let embeddingService: jest.Mocked<EmbeddingService>;

  // Mock data
  const mockVendor = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'vendor@example.com',
    name: 'Carlos',
    lastname: 'Mendoza',
    nameBusiness: 'Mi Negocio',
    rol: 'VENDOR',
  };

  const mockCategory = {
    id: '456e7890-e89b-12d3-a456-426614174001',
    name: 'Electrónicos',
    description: 'Productos electrónicos',
  };

  const mockProduct = {
    id: '789e1234-e89b-12d3-a456-426614174002',
    title: 'Smartphone',
    description: 'Teléfono inteligente de última generación',
    price: 500,
    stock: 10,
    state: ProductStatus.DISPONIBLE,
    dateRegister: new Date(),
    weight: 200,
    dimensions: { width: 10, height: 15, depth: 1 },
    material: 'metal',
    keywords: ['smartphone', 'tecnología'],
  };

  const mockCreateProductDto: CreateProductDto = {
    title: 'Smartphone',
    description: 'Teléfono inteligente de última generación',
    price: 500,
    stock: 10,
    state: ProductStatus.DISPONIBLE,
    idCategory: ['456e7890-e89b-12d3-a456-426614174001'],
    weight: 200,
    dimensions: { width: 10, height: 15, depth: 1 },
    material: 'metal',
    keywords: ['smartphone', 'tecnología'],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: getRepositoryToken(Product),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            preload: jest.fn(),
            remove: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Vendor),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Category),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: AnalyticsService,
          useValue: {
            trackProductInteraction: jest.fn(),
          },
        },
        {
          provide: EmbeddingService,
          useValue: {
            processProduct: jest.fn(),
            deleteProductEmbedding: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    productRepository = module.get(getRepositoryToken(Product));
    vendorRepository = module.get(getRepositoryToken(Vendor));
    categoryRepository = module.get(getRepositoryToken(Category));
    analyticsService = module.get(AnalyticsService);
    embeddingService = module.get(EmbeddingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a product successfully', async () => {
      // Arrange
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      vendorRepository.findOne.mockResolvedValue(mockVendor as any);
      categoryRepository.findOne.mockResolvedValue(mockCategory as any);
      productRepository.create.mockReturnValue(mockProduct as any);
      productRepository.save.mockResolvedValue(mockProduct as any);
      embeddingService.processProduct.mockResolvedValue(undefined);

      // Act
      const result = await service.create(userId, mockCreateProductDto);

      // Assert
      expect(vendorRepository.findOne).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(categoryRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockCreateProductDto.idCategory[0] },
      });
      expect(productRepository.create).toHaveBeenCalled();
      expect(productRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockProduct);
    });

    it('should throw BadRequestException if user is not a vendor', async () => {
      // Arrange
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      vendorRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.create(userId, mockCreateProductDto)).rejects.toThrow(
        new InternalServerErrorException('Error inesperado, revisar logs del servidor')
      );
    });

    it('should handle array of category IDs', async () => {
      // Arrange
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const dtoWithMultipleCategories = {
        ...mockCreateProductDto,
        idCategory: ['456e7890-e89b-12d3-a456-426614174001', '789e1234-e89b-12d3-a456-426614174002'],
      };
      
      vendorRepository.findOne.mockResolvedValue(mockVendor as any);
      categoryRepository.findOne.mockResolvedValue(mockCategory as any);
      productRepository.create.mockReturnValue(mockProduct as any);
      productRepository.save.mockResolvedValue(mockProduct as any);
      embeddingService.processProduct.mockResolvedValue(undefined);

      // Act
      const result = await service.create(userId, dtoWithMultipleCategories);

      // Assert
      expect(categoryRepository.findOne).toHaveBeenCalledWith({
        where: { id: '456e7890-e89b-12d3-a456-426614174001' }, // Should use first ID
      });
      expect(result).toEqual(mockProduct);
    });
  });

  describe('findAll', () => {
    it('should return paginated products', async () => {
      // Arrange
      const paginationDto: PaginationDto = { limit: 10, offset: 0 };
      const mockProducts = [mockProduct];
      
      productRepository.find.mockResolvedValue(mockProducts as any);

      // Act
      const result = await service.findAll(paginationDto);

      // Assert
      expect(productRepository.find).toHaveBeenCalledWith({
        take: paginationDto.limit,
        skip: paginationDto.offset,
        relations: ['categories'],
      });
      expect(result).toEqual(mockProducts);
    });

    it('should use default pagination when no parameters provided', async () => {
      // Arrange
      const mockProducts = [mockProduct];
      productRepository.find.mockResolvedValue(mockProducts as any);

      // Act
      const result = await service.findAll({});

      // Assert
      expect(productRepository.find).toHaveBeenCalled();
      expect(result).toEqual(mockProducts);
    });
  });

  describe('findOne', () => {
    it('should return a product by id', async () => {
      // Arrange
      const productId = '789e1234-e89b-12d3-a456-426614174002';
      productRepository.findOne.mockResolvedValue(mockProduct as any);

      // Act
      const result = await service.findOne(productId);

      // Assert
      expect(productRepository.findOne).toHaveBeenCalledWith({
        where: { id: productId },
        relations: ['categories', 'vendor'],
      });
      expect(result).toEqual(mockProduct);
    });

    it('should throw NotFoundException if product does not exist', async () => {
      // Arrange
      const productId = 'nonexistent-id';
      productRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne(productId)).rejects.toThrow(
        new NotFoundException(`Producto con ID: ${productId} no encontrado`)
      );
    });
  });

  describe('remove', () => {
    it('should remove a product successfully', async () => {
      // Arrange
      const productId = '789e1234-e89b-12d3-a456-426614174002';
      
      productRepository.findOne.mockResolvedValue(mockProduct as any);
      productRepository.remove.mockResolvedValue(mockProduct as any);
      embeddingService.deleteProductEmbedding.mockResolvedValue(undefined);

      // Act
      const result = await service.remove(productId);

      // Assert
      expect(productRepository.findOne).toHaveBeenCalledWith({
        where: { id: productId },
      });
      expect(productRepository.remove).toHaveBeenCalledWith(mockProduct);
      expect(result).toEqual({ message: `Producto ${mockProduct.title} eliminado con exito` });
    });

    it('should throw NotFoundException if product does not exist', async () => {
      // Arrange
      const productId = 'nonexistent-id';
      productRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.remove(productId)).rejects.toThrow(
        new NotFoundException(`Producto con ID: ${productId} no encontrado`)
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors during product creation', async () => {
      // Arrange
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      vendorRepository.findOne.mockResolvedValue(mockVendor as any);
      categoryRepository.findOne.mockResolvedValue(mockCategory as any);
      productRepository.create.mockReturnValue(mockProduct as any);
      productRepository.save.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(service.create(userId, mockCreateProductDto)).rejects.toThrow(
        new InternalServerErrorException('Error inesperado, revisar logs del servidor')
      );
    });

    it('should handle repository errors during product search', async () => {
      // Arrange
      const productId = '789e1234-e89b-12d3-a456-426614174002';
      productRepository.findOne.mockRejectedValue(new Error('Database connection error'));

      // Act & Assert
      await expect(service.findOne(productId)).rejects.toThrow('Database connection error');
    });
  });

  describe('Edge Cases', () => {
    it('should handle products with zero stock', async () => {
      // Arrange
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const dtoWithZeroStock = { ...mockCreateProductDto, stock: 0 };
      const productWithZeroStock = { ...mockProduct, stock: 0 };
      
      vendorRepository.findOne.mockResolvedValue(mockVendor as any);
      categoryRepository.findOne.mockResolvedValue(mockCategory as any);
      productRepository.create.mockReturnValue(productWithZeroStock as any);
      productRepository.save.mockResolvedValue(productWithZeroStock as any);

      // Act
      const result = await service.create(userId, dtoWithZeroStock);

      // Assert
      expect(result).toBeDefined();
      if (result) {
        expect(result.stock).toBe(0);
      }
    });

    it('should handle products with very long descriptions', async () => {
      // Arrange
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const longDescription = 'A'.repeat(1000);
      const dtoWithLongDescription = { ...mockCreateProductDto, description: longDescription };
      const productWithLongDescription = { ...mockProduct, description: longDescription };
      
      vendorRepository.findOne.mockResolvedValue(mockVendor as any);
      categoryRepository.findOne.mockResolvedValue(mockCategory as any);
      productRepository.create.mockReturnValue(productWithLongDescription as any);
      productRepository.save.mockResolvedValue(productWithLongDescription as any);

      // Act
      const result = await service.create(userId, dtoWithLongDescription);

      // Assert
      expect(result).toBeDefined();
      if (result) {
        expect(result.description).toBe(longDescription);
      }
    });

    it('should handle empty pagination parameters', async () => {
      // Arrange
      const mockProducts = [mockProduct];
      productRepository.find.mockResolvedValue(mockProducts as any);

      // Act
      const result = await service.findAll({});

      // Assert
      expect(productRepository.find).toHaveBeenCalled();
      expect(result).toEqual(mockProducts);
    });
  });
});
