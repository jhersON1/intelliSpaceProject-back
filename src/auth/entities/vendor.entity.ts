import { ChildEntity, Column, Entity, OneToMany } from 'typeorm';
import { User } from './user.entity';
import { Product } from '../../products/entities/product.entity';

@ChildEntity()
export class Vendor extends User {
  @Column('text', { unique: true })
  nameBusiness: string;

  @Column('text', { nullable: true })
  description: string;

  @Column('text')
  logo?: string;

  @Column('text', { array: true })
  verificationDocuments: string[];

  @Column({ type: 'json' })
  attentionHours: object;

  @Column({ type: 'enum', enum: ['INDIVIDUAL', 'EMPRESA'] })
  typeVendor: string;

  @OneToMany(() => Product, (product) => product.vendor)
  products: Product[];
}
