import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category } from './entities/category.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger('CategoriesService');

  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  async create(createCategoryDto: CreateCategoryDto) {
    try {
      let parentCategory: Category | null = null;

      // Si tiene categoría padre, cargarla
      if (createCategoryDto.parent?.id) {
        parentCategory = await this.categoryRepository.findOne({
          where: { id: createCategoryDto.parent.id },
        });

        if (!parentCategory) {
          throw new NotFoundException(
            `La categoría padre con ID ${createCategoryDto.parent.id} no existe`,
          );
        }

        if (parentCategory.level == 3) {
          throw new BadRequestException(
            'No se pueden crear subcategorías de una categoría con nivel 3',
          );
        }
      }

      // Crear la categoría base
      const category = this.categoryRepository.create(createCategoryDto);

      // Asignar metadatos
      if (!parentCategory) {
        category.level = 0;
      } else {
        category.parent = parentCategory;
        category.level = parentCategory.level + 1;
      }

      // Guardar
      const savedCategory = await this.categoryRepository.save(category);

      return savedCategory;
    } catch (error) {
      this.handleExceptions(error);
    }
  }

  async findAll() {
    try {
      return await this.categoryRepository.find({
        relations: ['parent'],
      });
    } catch (error) {
      this.handleExceptions(error);
    }
  }

  async findOne(id: string) {
    try {
      const category = await this.categoryRepository.findOne({
        where: { id },
        relations: ['parent'],
      });

      if (!category) {
        throw new NotFoundException(`Categoría con ID ${id} no encontrada`);
      }

      return category;
    } catch (error) {
      this.handleExceptions(error);
    }
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    try {
      // Verificar si la categoría existe
      const category = await this.categoryRepository.findOne({
        where: { id },
      });

      if (!category) {
        throw new NotFoundException(`Categoría con ID ${id} no encontrada`);
      }

      // Verificar si la categoría padre existe, si se proporciona
      let level = category.level; // Mantener el nivel actual si no se proporciona un nuevo padre
      let updatedParent = category.parent; // Mantener el padre actual si no se proporciona uno nuevo

      if (updateCategoryDto.parent) {
        const parentExists = await this.categoryRepository.findOne({
          where: { id: updateCategoryDto.parent.id },
        });

        if (!parentExists) {
          throw new NotFoundException(
            `La categoría padre con ID ${updateCategoryDto.parent.id} no existe`,
          );
        }

        // Evitar ciclos: una categoría no puede ser su propia categoría padre o ancestro
        if (updateCategoryDto.parent.id === id) {
          throw new BadRequestException(
            'Una categoría no puede ser su propia categoría padre',
          );
        }

        // Establecer el nivel basado en el padre
        level = parentExists.level + 1;
        updatedParent = parentExists; // Actualizar el padre solo si se ha proporcionado uno nuevo
      }

      // Preparar la actualización, manteniendo el valor del padre si no se proporciona uno nuevo
      const categoryToUpdate = await this.categoryRepository.preload({
        id,
        ...updateCategoryDto,
        level, // Establecer el nuevo nivel de la categoría
        parent: updatedParent, // Mantener el valor del padre actual si no se proporciona uno nuevo
      });

      // Verificar si se pudo cargar la categoría para actualizarla
      if (!categoryToUpdate) {
        throw new NotFoundException(`Categoría con ID ${id} no encontrada`);
      }

      // Guardar los cambios
      const updatedCategory = await this.categoryRepository.save(
        categoryToUpdate,
      );

      return updatedCategory;
    } catch (error) {
      this.handleExceptions(error);
    }
  }

  async remove(id: string) {
    try {
      // Verificar si la categoría existe
      const category = await this.categoryRepository.findOne({
        where: { id },
      });

      if (!category) {
        throw new NotFoundException(`Categoría con ID ${id} no encontrada`);
      }

      // Reasignar subcategorías a null (más eficiente con QueryBuilder)
      await this.categoryRepository
        .createQueryBuilder()
        .update(Category)
        .set({ parent: null })
        .where('parentId = :id', { id })
        .execute();

      // Eliminar la categoría
      await this.categoryRepository.remove(category);

      return {
        message: 'Categoría eliminada exitosamente',
        id,
      };
    } catch (error) {
      this.handleExceptions(error);
    }
  }

  async findDirectSubcategories(id: string): Promise<Category[]> {
    return this.categoryRepository.find({
      where: { parent: { id } },
      relations: ['parent'],
    });
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
