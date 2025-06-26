import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { ClickTracking } from '../entities/click-tracking.entity';
import { ProductAnalytics } from '../entities/product-analytics.entity';
import { Product } from '../../products/entities/product.entity';

export interface HoltWintersParameters {
  alpha: number; // Parámetro de suavizado para el nivel (0-1)
  beta: number;  // Parámetro de suavizado para la tendencia (0-1)
  gamma: number; // Parámetro de suavizado para la estacionalidad (0-1)
  seasonalPeriods: number; // Número de períodos en un ciclo estacional
  trendWeight: number; // Peso para amplificar el efecto de la tendencia
}

export interface HoltWintersComponents {
  level: number;     // L_t - Nivel ajustado
  trend: number;     // T_t - Tendencia ajustada
  seasonal: number;  // S_t - Estacionalidad ajustada
  forecast: number;  // Pronóstico para el siguiente período
  trendRanking: number; // Ranking basado en tendencia
}

export interface DemandPeriod {
  period: number;
  date: Date;
  observedDemand: number; // Y_t - Clicks observados
  level?: number;
  trend?: number;
  seasonal?: number;
  forecast?: number;
}

export interface ProductTrendAnalysis {
  productId: string;
  productTitle: string;
  currentComponents: HoltWintersComponents;
  trendLabel: string;
  trendIcon: string;
  periodsAnalyzed: number;
  lastUpdate: Date;
  forecastNextPeriod: number;
  demandHistory: DemandPeriod[];
  parameters: HoltWintersParameters;
}

@Injectable()
export class HoltWintersService {
  // 🧪 PARÁMETROS DE PRUEBA - Períodos de 5 minutos para testing
  private readonly defaultParameters: HoltWintersParameters = {
    alpha: 0.4,    // Suavizado de nivel - respuesta moderada a cambios
    beta: 0.3,     // Suavizado de tendencia - captura tendencias graduales
    gamma: 0.2,    // Suavizado estacional - patrones estacionales suaves
    seasonalPeriods: 5, // 🧪 TESTING: 5 períodos de 5 minutos (25 min total)
    trendWeight: 2.0    // Amplificador de tendencia para ranking
  };

  constructor(
    @InjectRepository(ClickTracking)
    private readonly clickRepository: Repository<ClickTracking>,
    @InjectRepository(ProductAnalytics)
    private readonly analyticsRepository: Repository<ProductAnalytics>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  /**
   * Calcula el modelo Holt-Winters completo para un producto
   * 🧪 TESTING: Usando períodos de 5 minutos
   */
  async calculateHoltWinters(
    productId: string, 
    analysisPeriodMinutes: number = 60, // 🧪 TESTING: 60 minutos en lugar de 30 días
    customParameters?: Partial<HoltWintersParameters>
  ): Promise<ProductTrendAnalysis> {
    console.log(`🔮 INICIANDO ANÁLISIS HOLT-WINTERS para producto: ${productId} (${analysisPeriodMinutes} minutos)`);
    
    const parameters = { ...this.defaultParameters, ...customParameters };
    
    // Obtener datos históricos de demanda por períodos de 5 minutos
    const demandHistory = await this.getDemandHistoryByMinutes(productId, analysisPeriodMinutes);
    
    if (demandHistory.length < parameters.seasonalPeriods + 2) {
      console.log(`⚠️ Insufficient data for Holt-Winters: ${demandHistory.length} periods, need at least ${parameters.seasonalPeriods + 2}`);
      return this.createDefaultAnalysis(productId, parameters);
    }

    // Aplicar modelo Holt-Winters
    const processedHistory = this.applyHoltWintersModel(demandHistory, parameters);
    
    // Obtener componentes actuales (último período)
    const currentComponents = this.getCurrentComponents(processedHistory, parameters);
    
    // Clasificar tendencia
    const trendClassification = this.classifyTrend(currentComponents);
    
    // Obtener información del producto
    const product = await this.productRepository.findOne({
      where: { id: productId },
      select: ['title']
    });

    console.log(`✅ HOLT-WINTERS COMPLETADO:`, {
      productId,
      level: currentComponents.level.toFixed(2),
      trend: currentComponents.trend.toFixed(2),
      trendRanking: currentComponents.trendRanking.toFixed(2),
      classification: trendClassification.label
    });

    return {
      productId,
      productTitle: product?.title || 'Producto sin título',
      currentComponents,
      trendLabel: trendClassification.label,
      trendIcon: trendClassification.icon,
      periodsAnalyzed: processedHistory.length,
      lastUpdate: new Date(),
      forecastNextPeriod: currentComponents.forecast,
      demandHistory: processedHistory,
      parameters
    };
  }

  /**
   * Obtiene el historial de demanda (clicks) por períodos
   */
  private async getDemandHistory(productId: string, days: number): Promise<DemandPeriod[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    console.log(`📊 Obteniendo historial de demanda: ${days} días`);

    // Obtener clicks agrupados por día
    const dailyClicks = await this.clickRepository
      .createQueryBuilder('click')
      .select('DATE(click.createdAt)', 'date')
      .addSelect('COUNT(*)', 'clicks')
      .where('click.product.id = :productId', { productId })
      .andWhere('click.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate })
      .andWhere('click.interactionType = :type', { type: 'CLICK' })
      .groupBy('DATE(click.createdAt)')
      .orderBy('DATE(click.createdAt)', 'ASC')
      .getRawMany();

    // Crear serie temporal completa (incluyendo días sin clicks)
    const demandHistory: DemandPeriod[] = [];
    const currentDate = new Date(startDate);
    let period = 1;

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayData = dailyClicks.find(d => d.date === dateStr);
      
      demandHistory.push({
        period,
        date: new Date(currentDate),
        observedDemand: parseInt(dayData?.clicks || '0')
      });

      currentDate.setDate(currentDate.getDate() + 1);
      period++;
    }

    console.log(`📈 Historial generado: ${demandHistory.length} períodos, total clicks: ${demandHistory.reduce((sum, d) => sum + d.observedDemand, 0)}`);
    
    return demandHistory;
  }

  /**
   * 🧪 TESTING: Obtiene el historial de demanda (clicks) por períodos de 5 minutos
   */
  private async getDemandHistoryByMinutes(productId: string, totalMinutes: number): Promise<DemandPeriod[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMinutes(endDate.getMinutes() - totalMinutes);

    console.log(`📊 Obteniendo historial de demanda: ${totalMinutes} minutos (períodos de 5 min)`);

    // Obtener clicks agrupados por períodos de 5 minutos
    const clicksData = await this.clickRepository
      .createQueryBuilder('click')
      .select('click.createdAt', 'createdAt')
      .where('click.product.id = :productId', { productId })
      .andWhere('click.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate })
      .andWhere('click.interactionType = :type', { type: 'CLICK' })
      .orderBy('click.createdAt', 'ASC')
      .getMany();

    // Crear serie temporal completa en períodos de 5 minutos
    const demandHistory: DemandPeriod[] = [];
    const periodDurationMinutes = 5;
    const currentDate = new Date(startDate);
    let period = 1;

    while (currentDate < endDate) {
      const periodEnd = new Date(currentDate.getTime() + periodDurationMinutes * 60000);
      
      // Contar clicks en este período de 5 minutos
      const clicksInPeriod = clicksData.filter(click => {
        const clickTime = new Date(click.createdAt);
        return clickTime >= currentDate && clickTime < periodEnd;
      }).length;
      
      demandHistory.push({
        period,
        date: new Date(currentDate),
        observedDemand: clicksInPeriod
      });

      currentDate.setMinutes(currentDate.getMinutes() + periodDurationMinutes);
      period++;
    }

    console.log(`📈 Historial generado: ${demandHistory.length} períodos de 5 min, total clicks: ${demandHistory.reduce((sum, d) => sum + d.observedDemand, 0)}`);
    
    return demandHistory;
  }

  /**
   * Aplica el modelo Holt-Winters a los datos históricos
   */
  private applyHoltWintersModel(
    history: DemandPeriod[], 
    params: HoltWintersParameters
  ): DemandPeriod[] {
    console.log(`⚙️ Aplicando modelo Holt-Winters con parámetros:`, params);

    const { alpha, beta, gamma, seasonalPeriods } = params;
    const processedHistory = [...history];

    // Inicialización de componentes
    this.initializeComponents(processedHistory, seasonalPeriods);

    // Aplicar ecuaciones de Holt-Winters período por período
    for (let t = seasonalPeriods; t < processedHistory.length; t++) {
      const current = processedHistory[t];
      const previous = processedHistory[t - 1];
      const seasonalPrevious = processedHistory[t - seasonalPeriods];

      // 1. Calcular Nivel (L_t)
      // L_t = α(Y_t / S_{t-m}) + (1-α)(L_{t-1} + T_{t-1})
      const deseasonalizedDemand = current.observedDemand / (seasonalPrevious.seasonal || 1);
      current.level = alpha * deseasonalizedDemand + (1 - alpha) * (previous.level! + previous.trend!);

      // 2. Calcular Tendencia (T_t)
      // T_t = β(L_t - L_{t-1}) + (1-β)T_{t-1}
      current.trend = beta * (current.level - previous.level!) + (1 - beta) * previous.trend!;

      // 3. Calcular Estacionalidad (S_t)
      // S_t = γ(Y_t / L_t) + (1-γ)S_{t-m}
      current.seasonal = gamma * (current.observedDemand / current.level) + (1 - gamma) * seasonalPrevious.seasonal!;

      // 4. Calcular Pronóstico para el siguiente período
      // F_{t+1} = (L_t + T_t) * S_{t+1-m}
      const nextSeasonalIndex = ((t + 1) % seasonalPeriods) || seasonalPeriods;
      const nextSeasonal = processedHistory[nextSeasonalIndex - 1]?.seasonal || 1;
      current.forecast = (current.level + current.trend) * nextSeasonal;
    }

    return processedHistory;
  }

  /**
   * Inicializa los componentes para los primeros períodos
   */
  private initializeComponents(history: DemandPeriod[], seasonalPeriods: number): void {
    // Calcular nivel inicial como promedio de los primeros períodos
    const initialLevel = history.slice(0, seasonalPeriods)
      .reduce((sum, p) => sum + p.observedDemand, 0) / seasonalPeriods;

    // Calcular tendencia inicial usando regresión lineal simple
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < seasonalPeriods; i++) {
      sumX += i + 1;
      sumY += history[i].observedDemand;
      sumXY += (i + 1) * history[i].observedDemand;
      sumX2 += (i + 1) * (i + 1);
    }
    const initialTrend = (seasonalPeriods * sumXY - sumX * sumY) / (seasonalPeriods * sumX2 - sumX * sumX);

    // Calcular factores estacionales iniciales
    const seasonalFactors: number[] = [];
    for (let s = 0; s < seasonalPeriods; s++) {
      seasonalFactors[s] = history[s].observedDemand / initialLevel;
    }

    // Asignar valores iniciales
    for (let i = 0; i < Math.min(seasonalPeriods, history.length); i++) {
      history[i].level = initialLevel;
      history[i].trend = initialTrend;
      history[i].seasonal = seasonalFactors[i];
      history[i].forecast = initialLevel + initialTrend;
    }

    console.log(`🎯 Inicialización completada: Level=${initialLevel.toFixed(2)}, Trend=${initialTrend.toFixed(2)}`);
  }

  /**
   * Obtiene los componentes actuales (del último período)
   */
  private getCurrentComponents(
    history: DemandPeriod[], 
    params: HoltWintersParameters
  ): HoltWintersComponents {
    const lastPeriod = history[history.length - 1];
    
    const components: HoltWintersComponents = {
      level: lastPeriod.level || 0,
      trend: lastPeriod.trend || 0,
      seasonal: lastPeriod.seasonal || 1,
      forecast: lastPeriod.forecast || 0,
      trendRanking: 0
    };

    // Calcular ranking de tendencia
    // Ranking_tendencia = L_t + peso_tendencia × T_t
    components.trendRanking = components.level + (params.trendWeight * components.trend);

    return components;
  }

  /**
   * Clasifica la tendencia según el sistema definido
   * 🧪 TESTING: Umbrales ajustados para períodos de minutos
   */
  private classifyTrend(components: HoltWintersComponents): { label: string; icon: string } {
    const ranking = components.trendRanking;
    const trend = components.trend;

    // 🧪 TESTING: Sistema de clasificación ajustado para períodos de minutos
    if (ranking >= 5 && trend > 0.5) {  // Reducido de 50 y 5
      return { label: "🔥 TENDENCIA HOT", icon: "🔥" };
    } else if (ranking >= 2 && trend > 0.2) {  // Reducido de 25 y 2
      return { label: "📈 EN TENDENCIA", icon: "📈" };
    } else if (ranking >= 1 || Math.abs(trend) <= 0.2) {  // Reducido de 10 y 2
      return { label: "➡️ ESTABLE", icon: "➡️" };
    } else {
      return { label: "📉 PERDIENDO POPULARIDAD", icon: "📉" };
    }
  }

  /**
   * Crea un análisis por defecto para productos con datos insuficientes
   */
  private async createDefaultAnalysis(
    productId: string, 
    parameters: HoltWintersParameters
  ): Promise<ProductTrendAnalysis> {
    const product = await this.productRepository.findOne({
      where: { id: productId },
      select: ['title']
    });

    return {
      productId,
      productTitle: product?.title || 'Producto sin título',
      currentComponents: {
        level: 0,
        trend: 0,
        seasonal: 1,
        forecast: 0,
        trendRanking: 0
      },
      trendLabel: "➡️ DATOS INSUFICIENTES",
      trendIcon: "⚠️",
      periodsAnalyzed: 0,
      lastUpdate: new Date(),
      forecastNextPeriod: 0,
      demandHistory: [],
      parameters
    };
  }

  /**
   * Obtiene productos ordenados por tendencia (ranking)
   * 🧪 TESTING: Usando períodos de minutos
   */
  async getProductsByTrend(limit: number = 10): Promise<ProductTrendAnalysis[]> {
    console.log(`🏆 Obteniendo top ${limit} productos por tendencia Holt-Winters (TESTING MODE)`);

    // 🧪 TESTING: Obtener productos con actividad en la última hora
    const products = await this.productRepository
      .createQueryBuilder('product')
      .innerJoin('product.clicks', 'click')
      .where('click.createdAt >= :date', { 
        date: new Date(Date.now() - 60 * 60 * 1000) // 🧪 TESTING: Última 1 hora
      })
      .groupBy('product.id')
      .having('COUNT(click.id) >= :minClicks', { minClicks: 1 }) // 🧪 TESTING: Mínimo 1 click
      .getMany();

    console.log(`📊 Analizando ${products.length} productos activos (última hora)`);

    // Calcular Holt-Winters para cada producto
    const analyses: ProductTrendAnalysis[] = [];
    
    for (const product of products) {
      try {
        const analysis = await this.calculateHoltWinters(product.id, 60); // 🧪 60 minutos
        analyses.push(analysis);
      } catch (error) {
        console.error(`Error calculando Holt-Winters para ${product.id}:`, error);
      }
    }

    // Ordenar por ranking de tendencia (descendente)
    const sortedAnalyses = analyses
      .sort((a, b) => b.currentComponents.trendRanking - a.currentComponents.trendRanking)
      .slice(0, limit);

    console.log(`✅ Top productos por tendencia:`, 
      sortedAnalyses.map(a => ({
        title: a.productTitle,
        ranking: a.currentComponents.trendRanking.toFixed(2),
        trend: a.currentComponents.trend.toFixed(2),
        label: a.trendLabel
      }))
    );

    return sortedAnalyses;
  }

  /**
   * Actualiza el análisis de tendencia para un producto específico
   */
  async updateProductTrend(productId: string): Promise<ProductTrendAnalysis> {
    console.log(`🔄 Actualizando análisis de tendencia para producto: ${productId}`);
    
    const analysis = await this.calculateHoltWinters(productId);
    
    // Actualizar en ProductAnalytics si existe
    try {
      await this.updateAnalyticsWithTrend(productId, analysis);
    } catch (error) {
      console.warn(`No se pudo actualizar analytics para ${productId}:`, error.message);
    }
    
    return analysis;
  }

  /**
   * Actualiza la tabla ProductAnalytics con información de tendencia
   */
  private async updateAnalyticsWithTrend(
    productId: string, 
    analysis: ProductTrendAnalysis
  ): Promise<void> {
    let analytics = await this.analyticsRepository.findOne({
      where: { product: { id: productId } }
    });

    if (analytics) {
      (analytics as any).trendLevel = analysis.currentComponents.level;
      (analytics as any).trendSlope = analysis.currentComponents.trend;
      (analytics as any).trendRanking = analysis.currentComponents.trendRanking;
      (analytics as any).trendLabel = analysis.trendLabel;
      (analytics as any).lastTrendUpdate = new Date();

      await this.analyticsRepository.save(analytics);
      
      console.log(`📈 Analytics actualizado con tendencia para ${productId}`);
    }
  }
}
