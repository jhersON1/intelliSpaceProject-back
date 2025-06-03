import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  ManyToOne, 
  CreateDateColumn 
} from 'typeorm';
import { Product } from '../../products/entities/product.entity';

@Entity('stock_history')
export class StockHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('int')
  previousStock: number;

  @Column('int')
  newStock: number;

  @Column('int')
  stockChange: number; // Diferencia (newStock - previousStock)

  @Column('enum', { 
    enum: ['REPOSITION', 'SALE', 'ADJUSTMENT', 'DEPLETION'], 
    default: 'ADJUSTMENT' 
  })
  changeType: string;

  @Column('text', { nullable: true })
  notes: string;

  @Column('int', { nullable: true })
  daysSinceLastReposition: number; // Días desde la última reposición
  @ManyToOne(() => Product, {
    onDelete: 'CASCADE',
  })
  product: Product;

  @CreateDateColumn()
  createdAt: Date;
}
