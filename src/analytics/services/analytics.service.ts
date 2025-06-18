import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClickTracking } from '../entities/click-tracking.entity';
import { StockHistory } from '../entities/stock-history.entity';
import { ProductAnalytics } from '../entities/product-analytics.entity';
import { Product } from '../../products/entities/product.entity';
import { QueueTheoryService } from './queue-theory.service';

export interface ClickTrackingDto {
  productId: string;
  userIp?: string;
  userAgent?: string;
  interactionType?: 'CLICK' | 'VIEW' | 'SEARCH';
  referrer?: string;
  duration?: number;
}

export interface StockUpdateDto {
  productId: string;
  previousStock: number;
  newStock: number;
  changeType: 'REPOSITION' | 'SALE' | 'ADJUSTMENT' | 'DEPLETION';
  notes?: string;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(ClickTracking)
    private readonly clickRepository: Repository<ClickTracking>,
    @InjectRepository(StockHistory)
    private readonly stockRepository: Repository<StockHistory>,
    @InjectRepository(ProductAnalytics)
    private readonly analyticsRepository: Repository<ProductAnalytics>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly queueTheoryService: QueueTheoryService,
  ) {}

  /**
   * Registra un click o interacción en un producto
   */
  async trackProductInteraction(trackingData: ClickTrackingDto): Promise<ClickTracking> {
    const clickRecord = this.clickRepository.create({
      product: { id: trackingData.productId } as Product,
      userIp: trackingData.userIp,
      userAgent: trackingData.userAgent,
      interactionType: trackingData.interactionType || 'CLICK',
      referrer: trackingData.referrer,
      duration: trackingData.duration || 1,
    });

    const savedClick = await this.clickRepository.save(clickRecord);

    // Actualizar contador en analytics
    await this.updateAnalyticsCounters(trackingData.productId, trackingData.interactionType || 'CLICK');

    return savedClick;
  }
  /**
   * Registra cambios en el stock de un producto
   */
  async trackStockChange(stockData: StockUpdateDto): Promise<StockHistory> {
    const stockChange = stockData.newStock - stockData.previousStock;
    
    // Calcular días desde la última reposición si es una reposición
    let daysSinceLastReposition: number | undefined = undefined;
    if (stockData.changeType === 'REPOSITION') {
      const lastReposition = await this.stockRepository.findOne({
        where: {
          product: { id: stockData.productId },
          changeType: 'REPOSITION'
        },
        order: { createdAt: 'DESC' }
      });

      if (lastReposition) {
        const timeDiff = Date.now() - lastReposition.createdAt.getTime();
        daysSinceLastReposition = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
      }
    }

    const stockRecord = this.stockRepository.create({
      product: { id: stockData.productId } as Product,
      previousStock: stockData.previousStock,
      newStock: stockData.newStock,
      stockChange,
      changeType: stockData.changeType,
      notes: stockData.notes,
      daysSinceLastReposition,
    });    const savedStock = await this.stockRepository.save(stockRecord);

    // ✅ LOGGING PARA DEBUGGING
    console.log('📊 STOCK RECORD SAVED:', {
      stockRecordId: savedStock.id,
      productId: stockData.productId,
      changeType: stockData.changeType,
      stockChange,
      shouldRecalculate: stockData.changeType === 'REPOSITION' || stockData.changeType === 'DEPLETION'
    });    // Si es una reposición, agotamiento o venta significativa, recalcular métricas de cola
    const shouldRecalculate = stockData.changeType === 'REPOSITION' || 
                             stockData.changeType === 'DEPLETION' ||
                             (stockData.changeType === 'SALE' && Math.abs(stockChange) >= 10); // Cambios grandes de stock

    if (shouldRecalculate) {
      console.log('🔄 INICIATING METRICS RECALCULATION for product:', stockData.productId, 
        'Reason:', stockData.changeType, 'Change:', stockChange);
      
      const updatedAnalytics = await this.queueTheoryService.updateProductAnalytics(stockData.productId);
      
      console.log('✅ METRICS RECALCULATION COMPLETED:', {
        productId: stockData.productId,
        newUtilizationFactor: updatedAnalytics.utilizationFactor,
        newCongestionStatus: updatedAnalytics.congestionStatus,
        lastCalculation: updatedAnalytics.lastCalculation
      });
    }

    return savedStock;
  }

  /**
   * Actualiza contadores en ProductAnalytics
   */
  private async updateAnalyticsCounters(productId: string, interactionType: string): Promise<void> {
    let analytics = await this.analyticsRepository.findOne({
      where: { product: { id: productId } }
    });

    if (!analytics) {
      analytics = this.analyticsRepository.create({
        product: { id: productId } as Product,
        totalClicks: 0,
        totalViews: 0,
        totalSearches: 0,
      });
    }

    // Incrementar contador según el tipo de interacción
    switch (interactionType) {
      case 'CLICK':
        analytics.totalClicks += 1;
        break;
      case 'VIEW':
        analytics.totalViews += 1;
        break;
      case 'SEARCH':
        analytics.totalSearches += 1;
        break;
    }

    await this.analyticsRepository.save(analytics);
  }

  /**
   * Obtiene estadísticas de un producto específico
   */
  async getProductStats(productId: string): Promise<any> {
    const analytics = await this.analyticsRepository.findOne({
      where: { product: { id: productId } },
      relations: ['product']
    });

    if (!analytics) {
      return {
        productId,
        totalClicks: 0,
        totalViews: 0,
        totalSearches: 0,
        queueMetrics: null
      };
    }

    const queueMetrics = await this.queueTheoryService.calculateQueueMetrics(productId);

    return {
      productId,
      totalClicks: analytics.totalClicks,
      totalViews: analytics.totalViews,
      totalSearches: analytics.totalSearches,
      arrivalRate: analytics.arrivalRate,
      serviceRate: analytics.serviceRate,
      utilizationFactor: analytics.utilizationFactor,
      congestionStatus: analytics.congestionStatus,
      lastCalculation: analytics.lastCalculation,
      queueMetrics
    };
  }

  /**
   * Obtiene el historial de stock de un producto
   */
  async getStockHistory(productId: string, limit: number = 50): Promise<StockHistory[]> {
    return await this.stockRepository.find({
      where: { product: { id: productId } },
      order: { createdAt: 'DESC' },
      take: limit
    });
  }

  /**
   * Obtiene el historial de clicks de un producto
   */
  async getClickHistory(productId: string, limit: number = 100): Promise<ClickTracking[]> {
    return await this.clickRepository.find({
      where: { product: { id: productId } },
      order: { createdAt: 'DESC' },
      take: limit
    });
  }

  /**
   * Recalcula todas las métricas de queue theory para todos los productos
   */
  async recalculateAllMetrics(): Promise<void> {
    const products = await this.productRepository.find();
    
    for (const product of products) {
      try {
        await this.queueTheoryService.updateProductAnalytics(product.id);
      } catch (error) {
        console.error(`Error recalculando métricas para producto ${product.id}:`, error);
      }
    }
  }  /**
   * Obtiene dashboard de analytics para un vendedor
   */
  async getVendorDashboard(vendorId: string): Promise<any> {
    console.log(`🔍 OBTENIENDO DASHBOARD PARA VENDEDOR: ${vendorId}`);
    
    const products = await this.productRepository.find({
      where: { vendor: { id: vendorId } },
      relations: ['analytics']
    });

    console.log(`📦 PRODUCTOS ENCONTRADOS: ${products.length}`);

    // Calcular interacciones totales (clicks + views + searches)
    const totalInteractions = products.reduce((total, product) => {
      if (product.analytics) {
        const productInteractions = 
          (product.analytics.totalClicks || 0) + 
          (product.analytics.totalViews || 0) + 
          (product.analytics.totalSearches || 0);
        return total + productInteractions;
      }
      return total;
    }, 0);

    // Calcular utilización promedio
    const productsWithAnalytics = products.filter(p => p.analytics);
    const averageUtilization = productsWithAnalytics.length > 0 
      ? productsWithAnalytics.reduce((sum, p) => sum + (p.analytics?.utilizationFactor || 0), 0) / productsWithAnalytics.length
      : 0;

    console.log(`📊 PRODUCTOS CON ANALYTICS: ${productsWithAnalytics.length}`);    // 🔥 CALCULAR MÉTRICAS DE COLA AGREGADAS PARA EL DASHBOARD
    let aggregatedQueueMetrics: any = null;
    
    if (productsWithAnalytics.length > 0) {
      // Calcular promedios de las métricas de cola
      const totalLambda = productsWithAnalytics.reduce((sum, p) => sum + (p.analytics?.arrivalRate || 0), 0);
      const totalMu = productsWithAnalytics.reduce((sum, p) => sum + (p.analytics?.serviceRate || 0), 0);
      const avgRho = productsWithAnalytics.reduce((sum, p) => sum + (p.analytics?.utilizationFactor || 0), 0) / productsWithAnalytics.length;
      
      // Determinar estado general basado en los productos críticos
      const criticalCount = products.filter(p => p.analytics?.congestionStatus === 'CRITICO').length;
      const warningCount = products.filter(p => p.analytics?.congestionStatus === 'ADVERTENCIA').length;
      
      let status: string;
      let message: string;
      
      if (criticalCount > 0) {
        status = 'CRITICO';
        message = `${criticalCount} producto(s) en estado crítico. Requiere atención inmediata.`;
      } else if (warningCount > 0) {
        status = 'ADVERTENCIA';
        message = `${warningCount} producto(s) en advertencia. Monitorear de cerca.`;
      } else {
        status = 'ESTABLE';
        message = 'Todos los productos están en estado estable.';
      }

      aggregatedQueueMetrics = {
        lambda: totalLambda / productsWithAnalytics.length, // Lambda promedio
        mu: totalMu / productsWithAnalytics.length, // Mu promedio
        rho: avgRho, // Rho promedio
        status: status,
        message: message
      };

      console.log(`📈 MÉTRICAS AGREGADAS CALCULADAS:`, {
        lambda: aggregatedQueueMetrics.lambda,
        mu: aggregatedQueueMetrics.mu,
        rho: aggregatedQueueMetrics.rho,
        status: aggregatedQueueMetrics.status,
        criticalCount,
        warningCount
      });
    } else {
      console.log(`⚠️ NO HAY PRODUCTOS CON ANALYTICS PARA CALCULAR MÉTRICAS`);
    }

    const dashboard = {
      totalProducts: products.length,
      totalInteractions: totalInteractions,
      averageUtilization: averageUtilization,
      criticalProducts: products.filter(p => p.analytics?.congestionStatus === 'CRITICO').length,
      warningProducts: products.filter(p => p.analytics?.congestionStatus === 'ADVERTENCIA').length,
      stableProducts: products.filter(p => p.analytics?.congestionStatus === 'ESTABLE').length,
      topProducts: products
        .filter(p => p.analytics)
        .sort((a, b) => (b.analytics?.utilizationFactor || 0) - (a.analytics?.utilizationFactor || 0))
        .slice(0, 5)
        .map(p => ({
          id: p.id,
          title: p.title,
          utilizationFactor: p.analytics?.utilizationFactor,
          congestionStatus: p.analytics?.congestionStatus,
          totalClicks: p.analytics?.totalClicks,
          totalViews: p.analytics?.totalViews,
          totalSearches: p.analytics?.totalSearches
        })),
      alerts: [], // Placeholder para alertas
      queueMetrics: aggregatedQueueMetrics // 🔥 AHORA CALCULAMOS LAS MÉTRICAS REALES
    };

    console.log(`✅ DASHBOARD GENERADO:`, {
      totalProducts: dashboard.totalProducts,
      totalInteractions: dashboard.totalInteractions,
      criticalProducts: dashboard.criticalProducts,
      hasQueueMetrics: !!dashboard.queueMetrics
    });

    return dashboard;
  }
  /**
   * Obtiene la fecha de la última reposición de un producto
   */
  async getLastReposition(productId: string): Promise<Date | null> {
    const lastReposition = await this.stockRepository.findOne({
      where: {
        product: { id: productId },
        changeType: 'REPOSITION'
      },
      order: { createdAt: 'DESC' }
    });

    console.log(`🔍 BUSCANDO ÚLTIMA REPOSICIÓN PARA PRODUCTO ${productId}:`, {
      found: !!lastReposition,
      date: lastReposition?.createdAt,
      changeType: lastReposition?.changeType,
      stockChange: lastReposition?.stockChange
    });

    return lastReposition ? lastReposition.createdAt : null;
  }
}
