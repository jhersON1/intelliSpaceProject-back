import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalyticsService, ClickTrackingDto, StockUpdateDto } from './services/analytics.service';
import { QueueTheoryService } from './services/queue-theory.service';
import { Auth } from '../auth/decorators/auth.decorator';
import { ValidRoles } from '../auth/interfaces/valid-roles.interface';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { User } from '../auth/entities/user.entity';
import { Product } from '../products/entities/product.entity';
import { ClickTracking } from './entities/click-tracking.entity';
import { StockHistory } from './entities/stock-history.entity';

@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly queueTheoryService: QueueTheoryService,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ClickTracking)
    private readonly clickRepository: Repository<ClickTracking>,
    @InjectRepository(StockHistory)
    private readonly stockRepository: Repository<StockHistory>,
  ) {}

  @Post('track-click')
  async trackClick(@Body() clickData: ClickTrackingDto) {
    return await this.analyticsService.trackProductInteraction(clickData);
  }

  @Post('track-stock')
  @Auth(ValidRoles.VENDOR)
  async trackStock(@Body() stockData: StockUpdateDto) {
    return await this.analyticsService.trackStockChange(stockData);
  }

  @Get('product/:id/stats')
  async getProductStats(@Param('id', ParseUUIDPipe) productId: string) {
    return await this.analyticsService.getProductStats(productId);
  }

  @Get('product/:id/queue-metrics')
  async getQueueMetrics(
    @Param('id', ParseUUIDPipe) productId: string,
    @Query('period') period?: number
  ) {
    const analysisPeriod = period || 30;
    return await this.queueTheoryService.calculateQueueMetrics(productId, analysisPeriod);
  }

  @Get('product/:id/stock-history')
  async getStockHistory(
    @Param('id', ParseUUIDPipe) productId: string,
    @Query('limit') limit?: number
  ) {
    const recordLimit = limit || 50;
    return await this.analyticsService.getStockHistory(productId, recordLimit);
  }

  @Get('product/:id/click-history')
  async getClickHistory(
    @Param('id', ParseUUIDPipe) productId: string,
    @Query('limit') limit?: number
  ) {
    const recordLimit = limit || 100;
    return await this.analyticsService.getClickHistory(productId, recordLimit);
  }  @Get('priority-products')
  async getPriorityProducts(@Query('limit') limit?: number) {
    console.log('🚨🚨🚨 ENDPOINT PRIORITY-PRODUCTS LLAMADO 🚨🚨🚨');
    
    const productLimit = limit || 10;
    
    // ✅ NUEVO: Asegurar que todos los productos tengan analytics antes de obtener prioridades
    // Esto se ejecuta para todos los productos, no solo del vendedor, para mejorar los datos
    try {
      await this.queueTheoryService.ensureAnalyticsForAllProducts('all');
    } catch (error) {
      console.log('⚠️ Error ensuring analytics, continuing with existing data:', error.message);
    }
    
    const products = await this.queueTheoryService.getPriorityProducts(productLimit);
    
    console.log(`📋 OBTENIENDO ${products.length} PRODUCTOS PRIORITARIOS`);
    
    // Para cada producto, obtener la fecha de la última reposición real
    const transformedProducts = await Promise.all(
      products.map(async (product, index) => {
        // Buscar la última reposición en el historial de stock
        const lastReposition = await this.analyticsService.getLastReposition(product.id);
        
        const finalDate = lastReposition || product.datePublication;
        
        console.log(`📦 PRODUCTO ${product.title} (${product.id}):`, {
          lastReposition: lastReposition,
          datePublication: product.datePublication,
          finalDate: finalDate,
          utilizationFactor: product.analytics?.utilizationFactor || 0
        });
          return {
          id: product.id,
          name: product.title || 'Sin nombre',
          utilizationFactor: product.analytics?.utilizationFactor || 0,
          congestionStatus: product.analytics?.congestionStatus || 'ESTABLE',
          priority: this.calculatePriorityFromStatus(product.analytics?.congestionStatus || 'ESTABLE', product.analytics?.utilizationFactor || 0),
          lastReposition: finalDate,
          estimatedDaysUntilDepletion: product.analytics?.analysisPerioD || 0
        };
      })
    );
    
    console.log(`✅ PRODUCTOS PRIORITARIOS TRANSFORMADOS: ${transformedProducts.length}`);
    return transformedProducts;
  }@Get('critical-products')
  async getCriticalProducts() {
    const products = await this.queueTheoryService.getCriticalProducts();
    
    // Para cada producto, obtener la fecha de la última reposición real
    const transformedProducts = await Promise.all(
      products.map(async (product, index) => {
        // Buscar la última reposición en el historial de stock
        const lastReposition = await this.analyticsService.getLastReposition(product.id);
          return {
          id: product.id,
          name: product.title || 'Sin nombre',
          utilizationFactor: product.analytics?.utilizationFactor || 0,
          congestionStatus: product.analytics?.congestionStatus || 'CRITICO',
          priority: this.calculatePriorityFromStatus(product.analytics?.congestionStatus || 'CRITICO', product.analytics?.utilizationFactor || 0),
          lastReposition: lastReposition || product.datePublication,
          estimatedDaysUntilDepletion: product.analytics?.analysisPerioD || 0
        };
      })
    );
    
    return transformedProducts;
  }

  @Get('vendor-dashboard')
  @Auth(ValidRoles.VENDOR)
  async getVendorDashboard(@GetUser() user: User) {
    return await this.analyticsService.getVendorDashboard(user.id);
  }
  @Post('recalculate-metrics')
  @Auth(ValidRoles.VENDOR)
  async recalculateMetrics() {
    await this.analyticsService.recalculateAllMetrics();
    return { message: 'Métricas recalculadas exitosamente' };
  }

  /**
   * ✅ NUEVO ENDPOINT: Inicializar productos sin historial
   */
  @Post('initialize-products')
  @Auth(ValidRoles.VENDOR)
  async initializeProductsWithoutHistory() {
    console.log('🔄 MANUAL INITIALIZATION REQUEST received');
    
    try {
      // Inicializar productos sin historial
      const result = await this.queueTheoryService.initializeAllProductsWithoutHistory();
      
      // Recalcular métricas para todos los productos
      await this.analyticsService.recalculateAllMetrics();
      
      return {
        message: 'Inicialización completada exitosamente',
        productsInitialized: result.initialized,
        productsSkipped: result.skipped,
        nextStep: 'Métricas recalculadas automáticamente'
      };
    } catch (error) {
      console.error('❌ Error during initialization:', error);
      return {
        error: 'Error durante la inicialización',
        details: error.message
      };
    }
  }

  /**
   * ✅ NUEVO ENDPOINT: Genera datos de prueba para demostrar el funcionamiento del sistema
   */
  @Post('generate-test-data')
  @Auth(ValidRoles.VENDOR)
  async generateTestData(@GetUser() user: User) {
    console.log('🎯 GENERATING TEST DATA for demonstration');
    
    try {
      // 1. Obtener todos los productos disponibles
      const products = await this.productRepository.find({
        take: 10 // Limitamos a 10 productos para la demo
      });

      console.log(`📦 Found ${products.length} products for test data generation`);

      let clicksGenerated = 0;
      let stockChangesGenerated = 0;

      // 2. Para cada producto, generar clicks históricos realistas
      for (const product of products) {
        console.log(`🔄 Generating test data for product: ${product.title} (${product.id})`);
        
        // Generar entre 5 y 50 clicks por producto en los últimos 30 días
        const clickCount = Math.floor(Math.random() * 45) + 5;
        
        for (let i = 0; i < clickCount; i++) {
          // Generar fechas aleatorias en los últimos 30 días
          const daysAgo = Math.floor(Math.random() * 30);
          const hoursAgo = Math.floor(Math.random() * 24);
          const clickDate = new Date();
          clickDate.setDate(clickDate.getDate() - daysAgo);
          clickDate.setHours(clickDate.getHours() - hoursAgo);

          const clickRecord = this.clickRepository.create({
            product: { id: product.id } as Product,
            userIp: `192.168.1.${Math.floor(Math.random() * 254) + 1}`,
            userAgent: 'Test Data Generator',
            interactionType: Math.random() > 0.3 ? 'CLICK' : 'VIEW',
            referrer: 'test-data-generator',
            duration: Math.floor(Math.random() * 60) + 1,
            createdAt: clickDate
          });

          await this.clickRepository.save(clickRecord);
          clicksGenerated++;
        }

        // 3. Generar historial de stock realista si no existe
        const existingStockHistory = await this.stockRepository.findOne({
          where: { product: { id: product.id } }
        });

        if (!existingStockHistory) {
          // Generar entre 1 y 5 reposiciones en los últimos 30 días
          const repositionCount = Math.floor(Math.random() * 4) + 1;
          
          for (let i = 0; i < repositionCount; i++) {
            const daysAgo = Math.floor(Math.random() * 30);
            const repositionDate = new Date();
            repositionDate.setDate(repositionDate.getDate() - daysAgo);

            const stockRecord = this.stockRepository.create({
              product: { id: product.id } as Product,
              previousStock: Math.floor(Math.random() * 10),
              newStock: Math.floor(Math.random() * 50) + 10,
              stockChange: Math.floor(Math.random() * 40) + 10,
              changeType: 'REPOSITION',
              notes: `Test data reposition ${i + 1}`,
              daysSinceLastReposition: i === 0 ? undefined : Math.floor(Math.random() * 7) + 1,
              createdAt: repositionDate
            });

            await this.stockRepository.save(stockRecord);
            stockChangesGenerated++;
          }

          // Ocasionalmente generar un agotamiento
          if (Math.random() > 0.7) {
            const depletionDate = new Date();
            depletionDate.setDate(depletionDate.getDate() - Math.floor(Math.random() * 10));

            const depletionRecord = this.stockRepository.create({
              product: { id: product.id } as Product,
              previousStock: Math.floor(Math.random() * 20) + 1,
              newStock: 0,
              stockChange: -(Math.floor(Math.random() * 20) + 1),
              changeType: 'DEPLETION',
              notes: 'Test data depletion',
              createdAt: depletionDate
            });

            await this.stockRepository.save(depletionRecord);
            stockChangesGenerated++;
          }
        }
      }

      // 4. Recalcular todas las métricas
      console.log('🔄 Recalculating all metrics after test data generation');
      await this.analyticsService.recalculateAllMetrics();

      const result = {
        message: 'Test data generated successfully',
        summary: {
          productsProcessed: products.length,
          clicksGenerated,
          stockChangesGenerated,
          totalInteractions: clicksGenerated + stockChangesGenerated
        },
        nextSteps: [
          'Refresh the priority products dashboard to see the results',
          'Check individual product analytics to see the new metrics',
          'Test the queue theory calculations with the generated data'
        ]
      };

      console.log('✅ TEST DATA GENERATION COMPLETED:', result);
      return result;

    } catch (error) {
      console.error('❌ Error generating test data:', error);
      return {
        error: 'Error generating test data',
        details: error.message
      };
    }
  }

  /**
   * ✅ NUEVO ENDPOINT: Resetea el sistema de analytics para pruebas
   */
  @Post('reset-system')
  @Auth(ValidRoles.VENDOR)
  async resetSystem() {
    console.log('🔄 RESETTING ANALYTICS SYSTEM for clean testing');
    
    try {
      // 1. Limpiar todos los clicks históricos
      await this.clickRepository.delete({});
      console.log('✅ All click tracking records deleted');

      // 2. Limpiar todo el historial de stock
      await this.stockRepository.delete({});
      console.log('✅ All stock history records deleted');

      // 3. Asegurar que todos los productos tengan analytics básicos
      await this.queueTheoryService.ensureAnalyticsForAllProducts('all');
      console.log('✅ Analytics ensured for all products');

      // 4. Inicializar productos sin historial
      const initResult = await this.queueTheoryService.initializeAllProductsWithoutHistory();
      console.log('✅ Products without history initialized:', initResult);

      // 5. Recalcular todas las métricas
      await this.analyticsService.recalculateAllMetrics();
      console.log('✅ All metrics recalculated');

      return {
        message: 'System reset completed successfully',
        summary: {
          clicksDeleted: 'All',
          stockHistoryDeleted: 'All',
          productsInitialized: initResult.initialized,
          productsSkipped: initResult.skipped
        },
        nextSteps: [
          'System is now in clean state',
          'You can generate test data or start fresh testing',
          'All products should have basic analytics with ρ ≈ 0'
        ]
      };

    } catch (error) {
      console.error('❌ Error resetting system:', error);
      return {
        error: 'Error resetting system',
        details: error.message
      };
    }
  }

  /**
   * Calcula la prioridad numérica basada en el estado de congestión
   * Prioridad más BAJA = más CRÍTICO (1 = más urgente)
   */
  private calculatePriorityFromStatus(status: string, utilizationFactor: number): number {
    switch (status) {
      case 'CRITICO':
        // Los productos críticos tienen prioridad 1-10 basada en el factor de utilización
        return Math.max(1, Math.min(10, Math.floor(utilizationFactor * 10) + 1));
      case 'ADVERTENCIA':
        // Los productos de advertencia tienen prioridad 11-20
        return Math.max(11, Math.min(20, Math.floor(utilizationFactor * 10) + 11));
      case 'ESTABLE':
        // Los productos estables tienen prioridad 21+
        return Math.max(21, Math.floor(utilizationFactor * 100) + 21);
      default:
        return 99; // Sin datos
    }
  }

  /**
   * ✅ ENDPOINT PÚBLICO: Permite trackear clicks sin autenticación (para testing)
   */
  @Post('track-click-public')
  async trackClickPublic(@Body() clickData: ClickTrackingDto) {
    console.log('🎯 PUBLIC CLICK TRACKING:', clickData);
    
    try {
      const result = await this.analyticsService.trackProductInteraction(clickData);
      console.log('✅ Public click tracked successfully:', result.id);
      return result;
    } catch (error) {
      console.error('❌ Error in public click tracking:', error);
      return {
        error: 'Failed to track click',
        details: error.message
      };
    }
  }
}
