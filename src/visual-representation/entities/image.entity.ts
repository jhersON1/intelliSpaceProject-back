import { ChildEntity, Column, Entity } from 'typeorm';
import { VisualRepresentation } from './visual-representation.entity';

@ChildEntity()
export class Image extends VisualRepresentation {
  @Column('text', { nullable: true })
  altText?: string;

  @Column('bool', { default: false })
  isPrincipal: boolean;
}
