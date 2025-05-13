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
  ) {}

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
    const { format, texture, scale, url } = dto;

    const model3D = this.model3DRepository.create({
      url,
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
    const { instructions, devicerequirements, url } = dto;

    const experienceAR = this.experienceARRepository.create({
      url,
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
      where: { product: { id: productId } },
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
      where: { product: { id: productId } },
    });

    return experiencesAR;
  }

  findOne(id: number) {
    return `This action returns a #${id} visualRepresentation`;
  }

  update(
    id: number,
    updateVisualRepresentationDto: UpdateVisualRepresentationDto,
  ) {
    return `This action updates a #${id} visualRepresentation`;
  }

  remove(id: number) {
    return `This action removes a #${id} visualRepresentation`;
  }
}
