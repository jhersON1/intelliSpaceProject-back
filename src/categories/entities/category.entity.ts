import { Product } from '../../products/entities/product.entity';
import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  Tree,
  TreeParent,
  TreeChildren,
  Check,
  JoinColumn,
} from 'typeorm';

@Entity('category')
@Tree('closure-table')
@Check(`"level" <= 3`)
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  name: string;

  @Column('text', { nullable: true })
  description: string;

  @Column('text', { nullable: true })
  representativeImage: string;

  // Nivel de profundidad en el árbol
  @Column('int', { default: 0 })
  level: number;

  // Relaciones
  @OneToMany(() => Product, (product) => product.categories)
  products: Product[];

  @TreeParent()
  @JoinColumn({ name: 'parentId' })
  parent: Category | null;

  @TreeChildren()
  children: Category[];

}
