import {
  IsString,
  IsOptional,
  IsUUID,
  ValidateNested,
  IsNotEmpty,
  MinLength,
  IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';

class ParentCategoryDto {
  @IsUUID(undefined, {
    message: 'El ID de la categoría padre debe ser un UUID válido',
  })
  id: string;
}

export class CreateCategoryDto {
  @IsString({ message: 'El nombre de la categoría debe ser un texto' })
  @IsNotEmpty({ message: 'El nombre de la categoría es requerido' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  name: string;

  @IsString({ message: 'La descripción debe ser un texto' })
  @IsOptional()
  description?: string;

  @IsOptional()
  @IsString({
    message: 'La imagen representativa debe ser una URL en formato string',
  })
  @IsUrl({}, { message: 'La imagen representativa debe ser una URL válida' })
  representativeImage?: string;

  @IsOptional()
  @ValidateNested({ message: 'La categoría padre debe ser un objeto válido' })
  @Type(() => ParentCategoryDto)
  parent?: ParentCategoryDto;
}
