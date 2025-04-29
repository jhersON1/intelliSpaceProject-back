// create-user.dto.ts
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
  IsObject,
} from 'class-validator';

export enum UserRole {
  CONSUMER = 'CONSUMER',
  VENDOR = 'VENDOR',
}

export enum TypeVendor {
  INDIVIDUAL = 'INDIVIDUAL',
  EMPRESA = 'EMPRESA',
}

export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(6)
  @MaxLength(50)
  @Matches(/(?:(?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'La contraseña debe tener una letra mayúscula, una minúscula y un número',
  })
  password: string;

  @IsString()
  @MinLength(1)
  @IsNotEmpty()
  name: string;

  @IsString()
  @MinLength(1)
  @IsNotEmpty()
  lastname: string;

  @IsEnum(UserRole)
  @IsNotEmpty()
  rol: UserRole;

  // Campos específicos de Consumer
  @IsString()
  @IsNotEmpty()
  @ValidateIf((o) => o.rol === UserRole.CONSUMER)
  address: string;

  @IsObject()
  @IsOptional()
  @ValidateIf((o) => o.rol === UserRole.CONSUMER)
  preferences?: Record<string, any>;

  @IsString({ each: true })
  @IsOptional()
  @ValidateIf((o) => o.rol === UserRole.CONSUMER)
  searchsHistory?: string[];

  // Campos específicos de Vendor
  @IsString()
  @IsNotEmpty()
  @ValidateIf((o) => o.rol === UserRole.VENDOR)
  nameBusiness: string;

  @IsString()
  @IsOptional()
  @ValidateIf((o) => o.rol === UserRole.VENDOR)
  description?: string;

  @IsString()
  @IsOptional()
  @ValidateIf((o) => o.rol === UserRole.VENDOR)
  logo?: string;

  @IsString({ each: true })
  @IsOptional()
  @ValidateIf((o) => o.rol === UserRole.VENDOR)
  verificationDocuments?: string[];

  @IsObject()
  @IsOptional()
  @ValidateIf((o) => o.rol === UserRole.VENDOR)
  attentionHours?: Record<string, any>;

  @IsEnum(TypeVendor)
  @IsNotEmpty()
  @ValidateIf((o) => o.rol === UserRole.VENDOR)
  typeVendor: TypeVendor;
}
