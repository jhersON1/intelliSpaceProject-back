import { ChildEntity, Column, Entity } from 'typeorm';
import { VisualRepresentation } from './visual-representation.entity';

@ChildEntity()
export class ExperienceAR extends VisualRepresentation {
  @Column('text')
  instructions?: string;

  @Column('text', { array: true })
  devicerequirements: string[];
}
