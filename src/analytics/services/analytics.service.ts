import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClickTracking } from '../entities/click-tracking.entity';
import { StockHistory } from '../entities/stock-history.entity';
import { ProductAnalytics } from '../entities/product-analytics.entity';
import { Product } from '../../products/entities/product.entity';
import { QueueTheoryService } from './queue-theory.service';
import { HoltWintersService, ProductTrendAnalysis } from './holt-winters.service';

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
export class AnalyticsService {  constructor(
    @InjectRepository(ClickTracking)
    private readonly clickRepository: Repository<ClickTracking>,
    @InjectRepository(StockHistory)
    private readonly stockRepository: Repository<StockHistory>,
    @InjectRepository(ProductAnalytics)
    private readonly analyticsRepository: Repository<ProductAnalytics>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly queueTheoryService: QueueTheoryService,
    private readonly holtWintersService: HoltWintersService,
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

  /**
   * 🔮 NUEVO: Obtiene análisis de tendencia Holt-Winters para un producto
   */
  async getProductTrendAnalysis(productId: string): Promise<ProductTrendAnalysis> {
    console.log(`🔮 OBTENIENDO ANÁLISIS DE TENDENCIA HOLT-WINTERS para producto: ${productId}`);
    
    return await this.holtWintersService.calculateHoltWinters(productId);
  }

  /**
   * 🔮 NUEVO: Obtiene productos ordenados por tendencia (Trending Products)
   */
  async getTrendingProducts(limit: number = 10): Promise<ProductTrendAnalysis[]> {
    console.log(`🏆 OBTENIENDO PRODUCTOS EN TENDENCIA (Holt-Winters) - Límite: ${limit}`);
    
    return await this.holtWintersService.getProductsByTrend(limit);
  }

  /**
   * 🔮 NUEVO: Actualiza análisis de tendencia para un producto específico
   */
  async updateProductTrend(productId: string): Promise<ProductTrendAnalysis> {
    console.log(`🔄 ACTUALIZANDO ANÁLISIS DE TENDENCIA para producto: ${productId}`);
    
    return await this.holtWintersService.updateProductTrend(productId);
  }

  /**
   * 🔮 NUEVO: Dashboard de tendencias para vendedor con Holt-Winters
   */
  async getVendorTrendDashboard(vendorId: string): Promise<any> {
    console.log(`🔮 OBTENIENDO DASHBOARD DE TENDENCIAS PARA VENDEDOR: ${vendorId}`);
    
    const products = await this.productRepository.find({
      where: { vendor: { id: vendorId } },
      select: ['id', 'title']
    });

    console.log(`📦 ANALIZANDO TENDENCIAS DE ${products.length} PRODUCTOS`);

    // Analizar tendencias para cada producto del vendedor
    const trendAnalyses: ProductTrendAnalysis[] = [];
    
    for (const product of products) {
      try {
        const analysis = await this.holtWintersService.calculateHoltWinters(product.id);
        trendAnalyses.push(analysis);
      } catch (error) {
        console.warn(`⚠️ Error analizando tendencia de ${product.id}:`, error.message);
      }
    }

    // Clasificar productos por categorías de tendencia
    const hotProducts = trendAnalyses.filter(a => a.trendLabel.includes('HOT'));
    const trendingProducts = trendAnalyses.filter(a => a.trendLabel.includes('EN TENDENCIA'));
    const stableProducts = trendAnalyses.filter(a => a.trendLabel.includes('ESTABLE'));
    const decliningProducts = trendAnalyses.filter(a => a.trendLabel.includes('PERDIENDO'));

    // Calcular métricas agregadas
    const avgTrendRanking = trendAnalyses.length > 0 
      ? trendAnalyses.reduce((sum, a) => sum + a.currentComponents.trendRanking, 0) / trendAnalyses.length
      : 0;

    const avgTrendSlope = trendAnalyses.length > 0
      ? trendAnalyses.reduce((sum, a) => sum + a.currentComponents.trend, 0) / trendAnalyses.length
      : 0;

    // Top 5 productos con mejor tendencia
    const topTrendingProducts = trendAnalyses
      .sort((a, b) => b.currentComponents.trendRanking - a.currentComponents.trendRanking)
      .slice(0, 5)
      .map(a => ({
        id: a.productId,
        title: a.productTitle,
        trendRanking: Number(a.currentComponents.trendRanking.toFixed(2)),
        trendSlope: Number(a.currentComponents.trend.toFixed(2)),
        level: Number(a.currentComponents.level.toFixed(2)),
        label: a.trendLabel,
        icon: a.trendIcon,
        forecast: Number(a.forecastNextPeriod.toFixed(2))
      }));

    const dashboard = {
      vendorId,
      totalProducts: products.length,
      productsAnalyzed: trendAnalyses.length,
      
      // Métricas agregadas
      averageTrendRanking: Number(avgTrendRanking.toFixed(2)),
      averageTrendSlope: Number(avgTrendSlope.toFixed(2)),
      
      // Categorización de productos
      categoryBreakdown: {
        hot: hotProducts.length,
        trending: trendingProducts.length, 
        stable: stableProducts.length,
        declining: decliningProducts.length
      },
      
      // Top productos
      topTrendingProducts,
      
      // Productos por categoría con detalles
      productsByCategory: {
        hot: hotProducts.map(this.mapTrendAnalysisForDashboard),
        trending: trendingProducts.map(this.mapTrendAnalysisForDashboard),
        stable: stableProducts.slice(0, 3).map(this.mapTrendAnalysisForDashboard), // Limitar estables
        declining: decliningProducts.map(this.mapTrendAnalysisForDashboard)
      },
      
      // Alertas y recomendaciones
      alerts: this.generateTrendAlerts(trendAnalyses),
      
      lastUpdate: new Date()
    };

    console.log(`✅ DASHBOARD DE TENDENCIAS GENERADO:`, {
      totalProducts: dashboard.totalProducts,
      productsAnalyzed: dashboard.productsAnalyzed,
      avgTrendRanking: dashboard.averageTrendRanking,
      categoryBreakdown: dashboard.categoryBreakdown
    });

    return dashboard;
  }

  /**
   * 🔮 HELPER: Mapea análisis de tendencia para dashboard
   */
  private mapTrendAnalysisForDashboard(analysis: ProductTrendAnalysis): any {
    return {
      id: analysis.productId,
      title: analysis.productTitle,
      trendRanking: Number(analysis.currentComponents.trendRanking.toFixed(2)),
      trendSlope: Number(analysis.currentComponents.trend.toFixed(2)),
      level: Number(analysis.currentComponents.level.toFixed(2)),
      label: analysis.trendLabel,
      icon: analysis.trendIcon,
      forecast: Number(analysis.forecastNextPeriod.toFixed(2)),
      periodsAnalyzed: analysis.periodsAnalyzed
    };
  }

  /**
   * 🔮 HELPER: Genera alertas basadas en análisis de tendencias
   */
  private generateTrendAlerts(analyses: ProductTrendAnalysis[]): any[] {
    const alerts: any[] = [];

    // Alertas para productos en declive
    const decliningProducts = analyses.filter(a => 
      a.currentComponents.trend < -2 && a.currentComponents.level > 10
    );

    if (decliningProducts.length > 0) {
      alerts.push({
        type: 'warning',
        title: 'Productos Perdiendo Popularidad',
        message: `${decliningProducts.length} producto(s) muestran tendencia descendente significativa`,
        products: decliningProducts.map(p => p.productTitle).slice(0, 3),
        actionRequired: 'Revisar estrategia de marketing o promociones'
      });
    }

    // Alertas para productos hot
    const hotProducts = analyses.filter(a => 
      a.currentComponents.trend > 5 && a.trendLabel.includes('HOT')
    );

    if (hotProducts.length > 0) {
      alerts.push({
        type: 'success',
        title: 'Productos en Tendencia HOT',
        message: `${hotProducts.length} producto(s) con crecimiento acelerado`,
        products: hotProducts.map(p => p.productTitle).slice(0, 3),
        actionRequired: 'Considerar aumentar stock y promocionar más'
      });
    }

    // Alerta por falta de datos
    const insufficientData = analyses.filter(a => a.periodsAnalyzed < 7);
    
    if (insufficientData.length > 0) {
      alerts.push({
        type: 'info',
        title: 'Datos Insuficientes',
        message: `${insufficientData.length} producto(s) necesitan más historial para análisis preciso`,
        products: insufficientData.map(p => p.productTitle).slice(0, 3),
        actionRequired: 'El análisis mejorará con más actividad'
      });
    }

    return alerts;
  }

  /**
   * 🔮 NUEVO: Análisis completo combinando Queue Theory + Holt-Winters
   */
  async getCompleteProductAnalysis(productId: string): Promise<any> {
    console.log(`🎯 OBTENIENDO ANÁLISIS COMPLETO (Queue Theory + Holt-Winters) para: ${productId}`);

    try {
      // Obtener análisis de teoría de colas existente
      const queueMetrics = await this.queueTheoryService.calculateQueueMetrics(productId);
      
      // Obtener análisis de tendencia Holt-Winters
      const trendAnalysis = await this.holtWintersService.calculateHoltWinters(productId);
      
      // Obtener estadísticas básicas
      const basicStats = await this.getProductStats(productId);

      // Combinar análisis
      const completeAnalysis = {
        productId,
        productTitle: trendAnalysis.productTitle,
        lastUpdate: new Date(),

        // Métricas de teoría de colas (gestión de inventario)
        queueTheory: {
          lambda: queueMetrics.lambda,
          mu: queueMetrics.mu,
          rho: queueMetrics.rho,
          status: queueMetrics.status,
          message: queueMetrics.message
        },

        // Análisis de tendencia Holt-Winters (predicción de demanda)
        trendAnalysis: {
          level: trendAnalysis.currentComponents.level,
          trend: trendAnalysis.currentComponents.trend,
          seasonal: trendAnalysis.currentComponents.seasonal,
          trendRanking: trendAnalysis.currentComponents.trendRanking,
          forecast: trendAnalysis.forecastNextPeriod,
          label: trendAnalysis.trendLabel,
          icon: trendAnalysis.trendIcon,
          periodsAnalyzed: trendAnalysis.periodsAnalyzed
        },

        // Estadísticas básicas
        basicStats: {
          totalClicks: basicStats.totalClicks,
          totalViews: basicStats.totalViews,
          totalSearches: basicStats.totalSearches
        },

        // Síntesis y recomendaciones
        synthesis: this.generateSynthesis(queueMetrics, trendAnalysis),
        
        // Datos históricos para gráficos
        demandHistory: trendAnalysis.demandHistory.slice(-14) // Últimos 14 días
      };

      console.log(`✅ ANÁLISIS COMPLETO GENERADO:`, {
        queueStatus: completeAnalysis.queueTheory.status,
        trendLabel: completeAnalysis.trendAnalysis.label,
        synthesis: completeAnalysis.synthesis.overallStatus
      });

      return completeAnalysis;

    } catch (error) {
      console.error(`❌ Error en análisis completo para ${productId}:`, error);
      throw new Error(`No se pudo completar el análisis para el producto ${productId}`);
    }
  }

  /**
   * 🔮 HELPER: Genera síntesis combinando Queue Theory y Holt-Winters
   */
  private generateSynthesis(queueMetrics: any, trendAnalysis: ProductTrendAnalysis): any {
    const queueStatus = queueMetrics.status;
    const trend = trendAnalysis.currentComponents.trend;
    const trendLabel = trendAnalysis.trendLabel;

    let overallStatus: string;
    let priority: 'HIGH' | 'MEDIUM' | 'LOW';
    let recommendations: string[];

    // Matriz de decisión combinada
    if (queueStatus === 'CRITICO' && trend > 2) {
      overallStatus = 'CRÍTICO - Alta demanda creciente, capacidad insuficiente';
      priority = 'HIGH';
      recommendations = [
        'URGENTE: Incrementar stock inmediatamente',
        'Aumentar frecuencia de reposiciones',
        'Considerar promocionar debido a alta tendencia',
        'Monitorear de cerca en las próximas 48 horas'
      ];
    } else if (queueStatus === 'CRITICO' && trend < -2) {
      overallStatus = 'PRECAUCIÓN - Demanda alta pero decreciente';
      priority = 'MEDIUM';
      recommendations = [
        'Reponer stock pero evaluar cantidades',
        'Analizar causas de la tendencia decreciente',
        'Considerar estrategias de retención de demanda',
        'Monitorear evolución semanal'
      ];
    } else if (queueStatus === 'ESTABLE' && trend > 3) {
      overallStatus = 'OPORTUNIDAD - Tendencia creciente, capacidad estable';
      priority = 'HIGH';
      recommendations = [
        'Aprovechar momentum de crecimiento',
        'Incrementar promoción del producto',
        'Preparar stock adicional para demanda futura',
        'Considerar expandir marketing'
      ];
    } else if (queueStatus === 'ESTABLE' && Math.abs(trend) <= 2) {
      overallStatus = 'ÓPTIMO - Sistema equilibrado';
      priority = 'LOW';
      recommendations = [
        'Mantener estrategia actual',
        'Monitoreo rutinario',
        'Buscar oportunidades de optimización menores'
      ];
    } else {
      overallStatus = 'REVISAR - Situación mixta requiere atención';
      priority = 'MEDIUM';
      recommendations = [
        'Análisis detallado de la situación',
        'Evaluar factores externos',
        'Ajustar estrategia según contexto específico'
      ];
    }

    return {
      overallStatus,
      priority,
      recommendations,
      queueImpact: queueStatus,
      trendImpact: trendLabel,
      confidenceLevel: trendAnalysis.periodsAnalyzed >= 14 ? 'HIGH' : 
                      trendAnalysis.periodsAnalyzed >= 7 ? 'MEDIUM' : 'LOW'
    };
  }
}
