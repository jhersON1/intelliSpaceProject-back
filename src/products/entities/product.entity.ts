import { VisualRepresentation } from './../../visual-representation/entities/visual-representation.entity';
import { insertDateRegistration } from 'src/utils/insert-date';
import { Vendor } from '../../auth/entities/vendor.entity';
import { Category } from '../../categories/entities/category.entity';
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('product')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  title: string;

  @Column('text', { nullable: true })
  description: string;

  @Column('json')
  dimensions: object;

  @Column('float')
  weight: number;

  @Column('text', { nullable: true })
  material: string;

  @Column('float', { default: 0 })
  price: number;

  @Column('int', { default: 0 })
  stock: number;

  @Column({ type: 'enum', enum: ['Agotado', 'Disponible'] })
  state: string;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  datePublication: Date;

  @Column('text', { array: true, default: [] })
  keywords: string[];

  @ManyToOne(() => Vendor, (vendor) => vendor.products, {
    onDelete: 'CASCADE',
  })
  vendor: Vendor;

  @ManyToOne(() => Category, (category) => category.products, {
    onDelete: 'CASCADE',
  })
  category: Category;

  @OneToMany(
    () => VisualRepresentation,
    (VisualRepresentation) => VisualRepresentation.product,
  )
  visualRepresentations: VisualRepresentation[];

  @BeforeInsert()
  insertDateRegistrationProduct() {
    const date = insertDateRegistration();
    this.datePublication = date;
  }
}
