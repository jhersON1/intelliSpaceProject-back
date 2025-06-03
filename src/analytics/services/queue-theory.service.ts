import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { ProductAnalytics } from '../entities/product-analytics.entity';
import { ClickTracking } from '../entities/click-tracking.entity';
import { StockHistory } from '../entities/stock-history.entity';
import { Product } from '../../products/entities/product.entity';

export interface QueueMetrics {
  lambda: number; // Tasa de llegadas (clicks/día)
  mu: number; // Tasa de servicio (reposiciones/día)
  rho: number; // Factor de utilización
  status: 'ESTABLE' | 'ADVERTENCIA' | 'CRITICO';
  message: string;
}

@Injectable()
export class QueueTheoryService {
  constructor(
    @InjectRepository(ProductAnalytics)
    private readonly analyticsRepository: Repository<ProductAnalytics>,
    @InjectRepository(ClickTracking)
    private readonly clickRepository: Repository<ClickTracking>,
    @InjectRepository(StockHistory)
    private readonly stockRepository: Repository<StockHistory>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  /**
   * Calcula las métricas M/M/1 para un producto específico
   */
  async calculateQueueMetrics(productId: string, analysisPeriodDays: number = 30): Promise<QueueMetrics> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - analysisPeriodDays);

    // Calcular λ (Lambda) - Tasa de llegadas
    const lambda = await this.calculateArrivalRate(productId, startDate, endDate, analysisPeriodDays);

    // Calcular μ (Mu) - Tasa de servicio
    const mu = await this.calculateServiceRate(productId, startDate, endDate);

    // Calcular ρ (Rho) - Factor de utilización
    const rho = mu === 0 ? Infinity : lambda / mu;

    // Determinar estado de congestión
    const status = this.determineQueueStatus(rho);
    const message = this.generateStatusMessage(rho, lambda, mu);

    return {
      lambda: Number(lambda.toFixed(4)),
      mu: Number(mu.toFixed(4)),
      rho: Number(rho.toFixed(4)),
      status,
      message
    };
  }

  /**
   * Calcula la tasa de llegadas (λ) - clicks por día
   */
  private async calculateArrivalRate(
    productId: string, 
    startDate: Date, 
    endDate: Date, 
    periodDays: number
  ): Promise<number> {
    const clickCount = await this.clickRepository.count({
      where: {
        product: { id: productId },
        createdAt: Between(startDate, endDate),
        interactionType: 'CLICK'
      }
    });

    return clickCount / periodDays;
  }

  /**
   * Calcula la tasa de servicio (μ) - capacidad de reposición por día
   */
  private async calculateServiceRate(productId: string, startDate: Date, endDate: Date): Promise<number> {
    const reposiciones = await this.stockRepository.find({
      where: {
        product: { id: productId },
        changeType: 'REPOSITION',
        createdAt: Between(startDate, endDate)
      },
      order: { createdAt: 'ASC' }
    });

    if (reposiciones.length < 2) {
      return 0; // No hay suficientes datos para calcular
    }

    // Calcular tiempo promedio entre reposiciones
    let totalDaysBetweenRepositions = 0;
    let repositionCount = 0;

    for (let i = 1; i < reposiciones.length; i++) {
      const timeDiff = reposiciones[i].createdAt.getTime() - reposiciones[i-1].createdAt.getTime();
      const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
      totalDaysBetweenRepositions += daysDiff;
      repositionCount++;
    }

    if (repositionCount === 0) return 0;

    const averageDaysBetweenRepositions = totalDaysBetweenRepositions / repositionCount;
    
    // μ = 1 / tiempo_promedio_reposición
    return 1 / averageDaysBetweenRepositions;
  }

  /**
   * Determina el estado de la cola basado en el factor de utilización
   */
  private determineQueueStatus(rho: number): 'ESTABLE' | 'ADVERTENCIA' | 'CRITICO' {
    if (rho >= 0.8 || rho === Infinity) {
      return 'CRITICO';
    } else if (rho >= 0.5) {
      return 'ADVERTENCIA';
    } else {
      return 'ESTABLE';
    }
  }

  /**
   * Genera mensaje descriptivo del estado
   */
  private generateStatusMessage(rho: number, lambda: number, mu: number): string {
    if (rho === Infinity) {
      return `Sistema colapsado - No hay reposiciones registradas. Demanda: ${lambda.toFixed(2)} clicks/día.`;
    } else if (rho >= 0.8) {
      return `CRÍTICO - Reponer urgentemente. Demanda (${lambda.toFixed(2)}) supera capacidad (${mu.toFixed(2)})`;
    } else if (rho >= 0.5) {
      return `ADVERTENCIA - Monitorear demanda. Factor ρ = ${rho.toFixed(2)}`;
    } else {
      return `ESTABLE - Demanda controlada. Factor ρ = ${rho.toFixed(2)}`;
    }
  }

  /**
   * Actualiza las métricas de analytics para un producto
   */
  async updateProductAnalytics(productId: string): Promise<ProductAnalytics> {
    const metrics = await this.calculateQueueMetrics(productId);
    
    let analytics = await this.analyticsRepository.findOne({
      where: { product: { id: productId } }
    });

    if (!analytics) {
      // Crear nueva entrada de analytics
      analytics = this.analyticsRepository.create({
        product: { id: productId } as Product,
        arrivalRate: metrics.lambda,
        serviceRate: metrics.mu,
        utilizationFactor: metrics.rho,
        congestionStatus: metrics.status,
        lastCalculation: new Date()
      });
    } else {
      // Actualizar entrada existente
      analytics.arrivalRate = metrics.lambda;
      analytics.serviceRate = metrics.mu;
      analytics.utilizationFactor = metrics.rho;
      analytics.congestionStatus = metrics.status;
      analytics.lastCalculation = new Date();
    }

    return await this.analyticsRepository.save(analytics);
  }

  /**
   * Obtiene productos prioritarios basados en factor de utilización
   */
  async getPriorityProducts(limit: number = 10): Promise<Product[]> {
    const products = await this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.analytics', 'analytics')
      .leftJoinAndSelect('product.categories', 'categories')
      .where('product.stock > 0')
      .orderBy('analytics.utilizationFactor', 'DESC')
      .limit(limit)
      .getMany();

    return products;
  }

  /**
   * Obtiene productos que necesitan reposición urgente
   */
  async getCriticalProducts(): Promise<Product[]> {
    return await this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.analytics', 'analytics')
      .leftJoinAndSelect('product.vendor', 'vendor')
      .where('analytics.congestionStatus = :status', { status: 'CRITICO' })
      .orderBy('analytics.utilizationFactor', 'DESC')
      .getMany();
  }
}
