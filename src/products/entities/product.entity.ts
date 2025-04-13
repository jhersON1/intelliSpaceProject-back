import { insertDateRegistration } from 'src/utils/insert-date';
import { Vendor } from '../../auth/entities/vendor.entity';
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('product')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  titulo: string;

  @Column('text', { nullable: true })
  descripcion: string;

  @Column('json')
  dimensiones: object;

  @Column('float')
  peso: number;

  @Column('text', { nullable: true })
  material: string;

  @Column('float', { default: 0 })
  precio: number;

  @Column('int', { default: 0 })
  stock: number;

  @Column({ type: 'enum', enum: ['Agotado', 'Disponible'] })
  estado: string;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  fechaPublicacion: Date;

  @Column('text', { array: true, default: [] })
  palabrasClave: string[];

  @ManyToOne(() => Vendor, (vendor) => vendor.products, {
    onDelete: 'CASCADE',
  })
  vendor: Vendor;

  @BeforeInsert()
  insertDateRegistrationProduct() {
    const date = insertDateRegistration();
    this.fechaPublicacion = date;
  }
}
