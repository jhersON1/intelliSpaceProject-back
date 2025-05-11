import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsEnum,
  IsArray,
  IsObject,
  ValidateNested,
  IsOptional,
  MinLength,
  ArrayMinSize,
  IsPositive,
  IsInt,
  IsUUID,
} from 'class-validator';

enum ProductStatus {
  AGOTADO = 'Agotado',
  DISPONIBLE = 'Disponible',
}

export class CreateProductDto {
  @IsString({ message: 'El título debe ser un texto' })
  @IsNotEmpty({ message: 'El título es requerido' })
  @MinLength(2, { message: 'El título debe tener al menos 2 caracteres' })
  title: string;

  @IsOptional()
  @IsString({ message: 'La descripción debe ser un texto' })
  @MinLength(10, {
    message: 'La descripción debe tener al menos 10 caracteres',
  })
  description?: string;

  @IsOptional()
  @IsObject({ message: 'Las dimensiones deben ser un objeto válido' })
  dimensions?: object;

  @IsNumber({}, { message: 'El peso debe ser un número válido' })
  @Min(0, { message: 'El peso debe ser mayor o igual a 0' })
  weight: number;

  @IsOptional()
  @IsString({ message: 'El material debe ser un texto' })
  material?: string;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  price?: number;

  @IsInt()
  @IsPositive()
  @IsOptional()
  stock?: number;

  @IsEnum(ProductStatus, {
    message: 'El estado debe ser "Agotado" o "Disponible"',
  })
  state: ProductStatus;

  @IsOptional()
  @IsArray({ message: 'Las palabras clave deben ser un arreglo de textos' })
  @IsString({ each: true, message: 'Cada palabra clave debe ser un texto' })
  keywords?: string[];

  @IsUUID(undefined, {
    message: 'El ID de la categoría debe ser un UUID válido',
  })
  idCategory: string;
}
