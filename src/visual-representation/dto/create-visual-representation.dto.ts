import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  ValidateIf,
} from 'class-validator';

export enum TypeRepresentation {
  IMAGE = 'Image',
  MODEL3D = 'Model3D',
  EXPERIENCEAR = 'ExperienceAR',
}

export enum FormatModel3D {
  GLB = '.glb',
  FBX = '.fbx',
  OBJ = '.obj',
  DAE = '.dae',
  USD = '.usd',
  GLTF = '.gltf',
  USDZ = '.usdz',
}

export class CreateVisualRepresentationDto {
  @IsString()
  productId: string;

  @IsEnum(TypeRepresentation)
  @IsNotEmpty()
  type: TypeRepresentation;

  @IsString()
  @IsOptional()
  @IsUrl()
  url?: string;

  // Campos específicos de Image
  @IsString()
  @IsOptional()
  @ValidateIf((o) => o.type === TypeRepresentation.IMAGE)
  altText?: string;

  @IsBoolean()
  @ValidateIf((o) => o.type === TypeRepresentation.IMAGE)
  isPrincipal: boolean;

  // Campos específicos de Model3D
  @IsEnum(FormatModel3D)
  @ValidateIf((o) => o.type === TypeRepresentation.MODEL3D)
  format: FormatModel3D;

  @IsString()
  @IsOptional()
  @ValidateIf((o) => o.type === TypeRepresentation.MODEL3D)
  texture?: string;

  @IsObject()
  @ValidateIf((o) => o.type === TypeRepresentation.MODEL3D)
  scale: Record<string, number>;

  // Campos específicos de ExperienceAR
  @IsString()
  @IsOptional()
  @ValidateIf((o) => o.type === TypeRepresentation.EXPERIENCEAR)
  instructions?: string;

  @IsArray()
  @IsString({ each: true })
  @ValidateIf((o) => o.type === TypeRepresentation.EXPERIENCEAR)
  devicerequirements: string[];
}
