import { VisualRepresentation } from './../../visual-representation/entities/visual-representation.entity';
import { insertDateRegistration } from 'src/utils/insert-date';
import { Vendor } from '../../auth/entities/vendor.entity';
import { Category } from '../../categories/entities/category.entity';
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  JoinColumn,
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

  @ManyToMany(() => Category)
  @JoinTable({
    name: 'product_categories',
    joinColumn: { name: 'productId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'categoryId', referencedColumnName: 'id' }
  })
  categories: Category[];

  @OneToMany(
    () => VisualRepresentation,
    (VisualRepresentation) => VisualRepresentation.product,
  )
  visualRepresentations: VisualRepresentation[];
  // Nuevas relaciones para Analytics
  @OneToOne('ProductAnalytics', 'product', { 
    cascade: true 
  })
  @JoinColumn()
  analytics: any;

  @OneToMany('StockHistory', 'product', { 
    cascade: true 
  })
  stockHistory: any[];

  @OneToMany('ClickTracking', 'product', { 
    cascade: true 
  })
  clickTracking: any[];

  @BeforeInsert()
  insertDateRegistrationProduct() {
    const date = insertDateRegistration();
    this.datePublication = date;
  }
}
