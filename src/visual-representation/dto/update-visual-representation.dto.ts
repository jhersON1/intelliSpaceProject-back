import { PartialType } from '@nestjs/mapped-types';
import { CreateVisualRepresentationDto } from './create-visual-representation.dto';

export class UpdateVisualRepresentationDto extends PartialType(CreateVisualRepresentationDto) {}
