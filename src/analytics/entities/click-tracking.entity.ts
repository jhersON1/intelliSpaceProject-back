import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  ManyToOne, 
  CreateDateColumn 
} from 'typeorm';
import { Product } from '../../products/entities/product.entity';

@Entity('click_tracking')
export class ClickTracking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { length: 45, nullable: true })
  userIp: string;

  @Column('text', { nullable: true })
  userAgent: string;

  @Column('enum', { 
    enum: ['CLICK', 'VIEW', 'SEARCH'], 
    default: 'CLICK' 
  })
  interactionType: string;

  @Column('varchar', { length: 100, nullable: true })
  referrer: string; // De dónde vino el usuario

  @Column('int', { default: 1 })
  duration: number; // Tiempo en la página (segundos)

  @ManyToOne(() => Product, {
    onDelete: 'CASCADE',
  })
  product: Product;

  @CreateDateColumn()
  createdAt: Date;
}
