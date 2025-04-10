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

export enum TipoVendedor {
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
  nombre: string;

  @IsString()
  @MinLength(1)
  @IsNotEmpty()
  apellido: string;

  @IsEnum(UserRole)
  @IsNotEmpty()
  rol: UserRole;

  // Campos específicos de Consumer
  @IsString()
  @IsNotEmpty()
  @ValidateIf((o) => o.rol === UserRole.CONSUMER)
  direccion: string;

  @IsObject()
  @IsOptional()
  @ValidateIf((o) => o.rol === UserRole.CONSUMER)
  preferencias?: Record<string, any>;

  @IsString({ each: true })
  @IsOptional()
  @ValidateIf((o) => o.rol === UserRole.CONSUMER)
  historialBusquedas?: string[];

  // Campos específicos de Vendor
  @IsString()
  @IsNotEmpty()
  @ValidateIf((o) => o.rol === UserRole.VENDOR)
  nombreNegocio: string;

  @IsString()
  @IsOptional()
  @ValidateIf((o) => o.rol === UserRole.VENDOR)
  descripcion?: string;

  @IsString()
  @IsNotEmpty()
  @ValidateIf((o) => o.rol === UserRole.VENDOR)
  logo: string;

  @IsString({ each: true })
  @IsOptional()
  @ValidateIf((o) => o.rol === UserRole.VENDOR)
  documentosVerificacion?: string[];

  @IsObject()
  @IsNotEmpty()
  @ValidateIf((o) => o.rol === UserRole.VENDOR)
  horarioAtencion: Record<string, any>;

  @IsEnum(TipoVendedor)
  @IsNotEmpty()
  @ValidateIf((o) => o.rol === UserRole.VENDOR)
  tipoVendedor: TipoVendedor;
}
