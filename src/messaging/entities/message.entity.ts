import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, JoinColumn } from 'typeorm';
import { Consumer } from '../../auth/entities/consumer.entity';
import { Vendor } from '../../auth/entities/vendor.entity';
import { Product } from '../../products/entities/product.entity';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  content: string;

  @Column('text')
  subject: string;

  @Column({ type: 'boolean', default: false })
  isRead: boolean;

  @CreateDateColumn()
  createdAt: Date;

  // Relación con el consumer que envía el mensaje
  @ManyToOne(() => Consumer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'consumerId' })
  consumer: Consumer;

  @Column('uuid')
  consumerId: string;

  // Relación con el vendor que recibe el mensaje
  @ManyToOne(() => Vendor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vendorId' })
  vendor: Vendor;

  @Column('uuid')
  vendorId: string;

  // Relación con el producto sobre el que se pregunta
  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column('uuid')
  productId: string;
}
