import { ChildEntity, Column, Entity, OneToMany } from 'typeorm';
import { User } from './user.entity';
import { Product } from '../../products/entities/product.entity';

@ChildEntity()
export class Vendor extends User {
  @Column('text', { unique: true })
  nombreNegocio: string;

  @Column('text', { nullable: true })
  descripcion: string;

  @Column('text')
  logo: string;

  @Column('text', { array: true })
  documentosVerificacion: string[];

  @Column({ type: 'json' })
  horarioAtencion: object;

  @Column({ type: 'enum', enum: ['INDIVIDUAL', 'EMPRESA'] })
  tipoVendedor: string;

  @OneToMany(() => Product, (product) => product.vendor)
  products: Product[];
}
