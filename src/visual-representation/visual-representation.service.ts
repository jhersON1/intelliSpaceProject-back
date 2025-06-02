import { BadRequestException, Injectable } from '@nestjs/common';
import {
  CreateVisualRepresentationDto,
  TypeRepresentation,
} from './dto/create-visual-representation.dto';
import { UpdateVisualRepresentationDto } from './dto/update-visual-representation.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from '../products/entities/product.entity';
import { DataSource, Repository } from 'typeorm';
import { ExperienceAR, Image, Model3D, VisualRepresentation } from './entities';

@Injectable()
export class VisualRepresentationService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(VisualRepresentation)
    private readonly visRepreRepository: Repository<VisualRepresentation>,
    @InjectRepository(Image)
    private readonly imageRepository: Repository<Image>,
    @InjectRepository(Model3D)
    private readonly model3DRepository: Repository<Model3D>,
    @InjectRepository(ExperienceAR)
    private readonly experienceARRepository: Repository<ExperienceAR>,
  ) { }

  async create(createVisualRepresentationDto: CreateVisualRepresentationDto) {
    const { productId, type } = createVisualRepresentationDto;

    const product = await this.productRepository.findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new BadRequestException('El Producto no existe');
    }

    // Iniciar una transacción para garantizar la integridad de los datos
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let result: Image | Model3D | ExperienceAR;

      // Crear la entidad según el tipo
      switch (type) {
        case TypeRepresentation.IMAGE:
          result = await this.createImage(
            createVisualRepresentationDto,
            product,
          );
          break;
        case TypeRepresentation.MODEL3D:
          result = await this.createModel3D(
            createVisualRepresentationDto,
            product,
          );
          break;
        case TypeRepresentation.EXPERIENCEAR:
          result = await this.createExperienceAR(
            createVisualRepresentationDto,
            product,
          );
          break;
        default:
          throw new BadRequestException(
            `Tipo de Representación ${type} no válido`,
          );
      }

      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      // Si hay un error, revertimos la transacción
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      // Liberamos el queryRunner en cualquier caso
      await queryRunner.release();
    }
  }

  private async createImage(
    dto: CreateVisualRepresentationDto,
    product: Product,
  ) {
    const { altText, isPrincipal, url } = dto;

    // Si es la imagen principal, asegurarse de que no haya otra imagen principal
    if (isPrincipal) {
      const existingPrincipal = await this.imageRepository.findOne({
        where: { product: { id: product.id }, isPrincipal: true },
      });

      if (existingPrincipal) {
        throw new BadRequestException(
          'Ya existe una imagen principal para este producto',
        );
      }
    }

    const image = this.imageRepository.create({
      url,
      altText,
      isPrincipal,
      product,
      type: TypeRepresentation.IMAGE,
    });

    return await this.imageRepository.save(image);
  }

  private async createModel3D(
    dto: CreateVisualRepresentationDto,
    product: Product,
  ) {

    const existingModel3D = await this.model3DRepository.findOne({
      where: { product: { id: product.id } },
    });

    if (existingModel3D) {
      throw new BadRequestException(
        'Ya existe un modelo 3D para este producto. Use el método de actualización para modificarlo.',
      );
    }

    const { format, texture, scale, url, urlIOS3D } = dto;

    const model3D = this.model3DRepository.create({
      url,
      urlIOS3D,
      format,
      texture,
      scale,
      product,
      type: TypeRepresentation.MODEL3D,
    });

    return await this.model3DRepository.save(model3D);
  }

  private async createExperienceAR(
    dto: CreateVisualRepresentationDto,
    product: Product,
  ) {

    const existingExperienceAR = await this.experienceARRepository.findOne({
      where: { product: { id: product.id } },
    });

    if (existingExperienceAR) {
      throw new BadRequestException(
        'Ya existe una experiencia AR para este producto. Use el método de actualización para modificarla.',
      );
    }

    const { instructions, devicerequirements, url, urlIOSAR } = dto;

    const experienceAR = this.experienceARRepository.create({
      url,
      urlIOSAR,
      instructions,
      devicerequirements: devicerequirements as string[],
      product,
      type: TypeRepresentation.EXPERIENCEAR,
    });

    return await this.experienceARRepository.save(experienceAR);
  }

  async findAllImages(productId: string) {
    const product = await this.productRepository.findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new BadRequestException('El Producto no existe');
    }

    const images = await this.imageRepository.find({
      where: { product: { id: productId } },
      order: { isPrincipal: 'DESC' }, // Ordenar: primero las imágenes principales
    });

    return images;
  }

  async findAllModel3D(productId: string) {
    const product = await this.productRepository.findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new BadRequestException('El Producto no existe');
    }

    const models3D = await this.model3DRepository.find({
      where: { 
        product: { id: productId },
        type: TypeRepresentation.MODEL3D
      },
    });

    return models3D;
  }

  async findAllExperienceAR(productId: string) {
    const product = await this.productRepository.findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new BadRequestException('El Producto no existe');
    }

    const experiencesAR = await this.experienceARRepository.find({
      where: { 
        product: { id: productId },
        type: TypeRepresentation.EXPERIENCEAR
      },
    });

    return experiencesAR;
  }

  async findOne(id: string) {
    // Buscar la representación visual en la tabla base
    const visualRepresentation = await this.visRepreRepository.findOne({
      where: { id },
      relations: ['product'],
    });

    if (!visualRepresentation) {
      throw new BadRequestException('La representación visual no existe');
    }

    let result;

    // Buscar los datos específicos según el tipo de representación
    switch (visualRepresentation.type) {
      case TypeRepresentation.IMAGE:
        result = await this.imageRepository.findOne({
          where: { id },
          relations: ['product'],
        });
        break;

      case TypeRepresentation.MODEL3D:
        result = await this.model3DRepository.findOne({
          where: { id },
          relations: ['product'],
        });
        break;

      case TypeRepresentation.EXPERIENCEAR:
        result = await this.experienceARRepository.findOne({
          where: { id },
          relations: ['product'],
        });
        break;

      default:
        throw new BadRequestException(
          `Tipo de representación ${visualRepresentation.type} no válido`,
        );
    }

    if (!result) {
      throw new BadRequestException(
        'No se pudo encontrar la representación visual específica',
      );
    }

    return result;
  }

  async update(
    id: string,
    updateVisualRepresentationDto: UpdateVisualRepresentationDto,
  ) {
    // Buscar la representación visual en la tabla base
    const visualRepresentation = await this.visRepreRepository.findOne({
      where: { id },
      relations: ['product'],
    });

    if (!visualRepresentation) {
      throw new BadRequestException('La representación visual no existe');
    }

    let result;

    // Actualizar según el tipo de representación
    switch (visualRepresentation.type) {
      case TypeRepresentation.MODEL3D:
        result = await this.updateModel3D(id, updateVisualRepresentationDto);
        break;

      case TypeRepresentation.EXPERIENCEAR:
        result = await this.updateExperienceAR(id, updateVisualRepresentationDto);
        break;

      default:
        throw new BadRequestException(
          `Actualización no implementada para el tipo ${visualRepresentation.type}`,
        );
    }

    return result;
  }

  private async updateModel3D(
    id: string,
    dto: UpdateVisualRepresentationDto,
  ) {
    const model3D = await this.model3DRepository.findOne({
      where: { id },
      relations: ['product'],
    });

    if (!model3D) {
      throw new BadRequestException('El modelo 3D no existe');
    }

    // Actualizar solo los campos proporcionados
    Object.assign(model3D, {
      ...(dto.url !== undefined && { url: dto.url }),
      ...(dto.urlIOS3D !== undefined && { urlIOS3D: dto.urlIOS3D }),
      ...(dto.format !== undefined && { format: dto.format }),
      ...(dto.texture !== undefined && { texture: dto.texture }),
      ...(dto.scale !== undefined && { scale: dto.scale }),
    });

    return await this.model3DRepository.save(model3D);
  }

  private async updateExperienceAR(
    id: string,
    dto: UpdateVisualRepresentationDto,
  ) {
    const experienceAR = await this.experienceARRepository.findOne({
      where: { id },
      relations: ['product'],
    });

    if (!experienceAR) {
      throw new BadRequestException('La experiencia AR no existe');
    }

    // Actualizar solo los campos proporcionados
    Object.assign(experienceAR, {
      ...(dto.url !== undefined && { url: dto.url }),
      ...(dto.urlIOSAR !== undefined && { urlIOSAR: dto.urlIOSAR }),
      ...(dto.instructions !== undefined && { instructions: dto.instructions }),
      ...(dto.devicerequirements !== undefined && { devicerequirements: dto.devicerequirements }),
    });

    return await this.experienceARRepository.save(experienceAR);
  }

  async remove(id: string) {
    // Buscar la representación visual en la tabla base
    const visualRepresentation = await this.visRepreRepository.findOne({
      where: { id },
      relations: ['product'],
    });

    if (!visualRepresentation) {
      throw new BadRequestException('La representación visual no existe');
    }

    // Iniciar una transacción para garantizar la integridad de los datos
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let result;

      // Eliminar según el tipo de representación
      switch (visualRepresentation.type) {
        case TypeRepresentation.IMAGE:
          const image = await this.imageRepository.findOne({
            where: { id },
          });
          if (image) {
            result = await this.imageRepository.remove(image);
          }
          break;

        case TypeRepresentation.MODEL3D:
          const model3D = await this.model3DRepository.findOne({
            where: { id },
          });
          if (model3D) {
            result = await this.model3DRepository.remove(model3D);
          }
          break;

        case TypeRepresentation.EXPERIENCEAR:
          const experienceAR = await this.experienceARRepository.findOne({
            where: { id },
          });
          if (experienceAR) {
            result = await this.experienceARRepository.remove(experienceAR);
          }
          break;

        default:
          throw new BadRequestException(
            `Tipo de representación ${visualRepresentation.type} no válido`,
          );
      }

      await queryRunner.commitTransaction();

      return {
        message: 'Representación visual eliminada correctamente',
        deletedId: id,
        type: visualRepresentation.type,
      };
    } catch (error) {
      // Si hay un error, revertimos la transacción
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      // Liberamos el queryRunner en cualquier caso
      await queryRunner.release();
    }
  }

  public async findPrincipalImage(productId: string) {
    const product = await this.productRepository.findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new BadRequestException('El Producto no existe');
    }

    const principalImage = await this.imageRepository.findOne({
      where: {
        product: { id: productId },
        isPrincipal: true
      },
    });

    if (!principalImage) {
      throw new BadRequestException('No se encontró una imagen principal para este producto');
    }

    return principalImage;
  }
}
