import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  TableInheritance,
} from 'typeorm';
import { Product } from '../../products/entities/product.entity';

@Entity('visual_representation')
@TableInheritance({ column: { type: 'varchar', name: 'type' } })
export class VisualRepresentation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text', { nullable: true })
  url?: string;

  @ManyToOne(() => Product, (product) => product.visualRepresentations, {
    onDelete: 'CASCADE',
  })
  product: Product;

  @Column({ type: 'enum', enum: ['Image', 'Model3D', 'ExperienceAR'] })
  type: string;
}
