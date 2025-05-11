import { Product } from 'src/products/entities/product.entity';
import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  Tree,
  TreeParent,
  TreeChildren,
  CreateDateColumn,
  BeforeInsert,
  BeforeUpdate,
  Check,
} from 'typeorm';

@Entity('category')
@Tree('closure-table')
@Check(`"level" <= 3`) // Limitar profundidad máxima
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

  // Ruta completa de la categoría
  @Column('text')
  path: string;

  // Relaciones
  @OneToMany(() => Product, (product) => product.category)
  products: Product[];

  @TreeParent()
  parent: Category;

  @TreeChildren()
  children: Category[];

  // Métodos
  @BeforeInsert()
  @BeforeUpdate()
  setMetadata() {
    // Calcular nivel y ruta
    if (!this.parent) {
      this.level = 0;
      this.path = this.name;
    } else {
      this.level = (this.parent.level || 0) + 1;
      this.path = `${this.parent.path} > ${this.name}`;
    }
  }
}
