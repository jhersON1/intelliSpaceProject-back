import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  OneToOne, 
  CreateDateColumn,
  UpdateDateColumn
} from 'typeorm';
import { Product } from '../../products/entities/product.entity';

@Entity('product_analytics')
export class ProductAnalytics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('int', { default: 0 })
  totalClicks: number;

  @Column('int', { default: 0 })
  totalViews: number;

  @Column('int', { default: 0 })
  totalSearches: number;

  @Column('float', { default: 0 })
  arrivalRate: number; // λ (lambda) - tasa de llegadas

  @Column('float', { default: 0 })
  serviceRate: number; // μ (mu) - tasa de servicio

  @Column('float', { default: 0 })
  utilizationFactor: number; // ρ (rho) - factor de utilización

  @Column('enum', { 
    enum: ['ESTABLE', 'ADVERTENCIA', 'CRITICO'], 
    default: 'ESTABLE' 
  })
  congestionStatus: string;

  @Column('timestamp', { nullable: true })
  lastCalculation: Date;

  @Column('int', { default: 30 })
  analysisPerioD: number; // Período de análisis en días

  @OneToOne(() => Product, (product) => product.analytics, {
    onDelete: 'CASCADE',
  })
  product: Product;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
