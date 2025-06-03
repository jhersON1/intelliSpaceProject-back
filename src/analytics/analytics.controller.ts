import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AnalyticsService, ClickTrackingDto, StockUpdateDto } from './services/analytics.service';
import { QueueTheoryService } from './services/queue-theory.service';
import { Auth } from '../auth/decorators/auth.decorator';
import { ValidRoles } from '../auth/interfaces/valid-roles.interface';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { User } from '../auth/entities/user.entity';

@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly queueTheoryService: QueueTheoryService,
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
  }

  @Get('priority-products')
  async getPriorityProducts(@Query('limit') limit?: number) {
    const productLimit = limit || 10;
    return await this.queueTheoryService.getPriorityProducts(productLimit);
  }

  @Get('critical-products')
  async getCriticalProducts() {
    return await this.queueTheoryService.getCriticalProducts();
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

  @Get('queue-theory-demo/:id')
  async getDemoQueueTheory(@Param('id', ParseUUIDPipe) productId: string) {
    const metrics = await this.queueTheoryService.calculateQueueMetrics(productId);
    
    return {
      productId,
      teoriaM_M_1: {
        definicion: 'Sistema de cola con arribos Poisson (λ) y servicio exponencial (μ) con un servidor',
        parametros: {
          lambda: {
            valor: metrics.lambda,
            descripcion: 'Tasa de llegadas (clicks por día)',
            formula: 'λ = Total_Clicks / Período_Días'
          },
          mu: {
            valor: metrics.mu,
            descripcion: 'Tasa de servicio (reposiciones por día)',
            formula: 'μ = 1 / Tiempo_Promedio_Entre_Reposiciones'
          },
          rho: {
            valor: metrics.rho,
            descripcion: 'Factor de utilización del sistema',
            formula: 'ρ = λ / μ'
          }
        },
        interpretacion: {
          estado: metrics.status,
          mensaje: metrics.message,
          algoritmo: this.getAlgorithmExplanation(metrics.rho)
        }
      }
    };
  }

  private getAlgorithmExplanation(rho: number): any {
    return {
      criterio: 'Algoritmo de Detección de Congestión basado en ρ',
      reglas: [
        {
          condicion: 'ρ ≥ 0.8',
          estado: 'CRÍTICO',
          accion: 'Reponer urgentemente - Sistema congestionado'
        },
        {
          condicion: '0.5 ≤ ρ < 0.8',
          estado: 'ADVERTENCIA',
          accion: 'Monitorear demanda - Posible congestión'
        },
        {
          condicion: 'ρ < 0.5',
          estado: 'ESTABLE',
          accion: 'Demanda controlada - Sistema operando normalmente'
        }
      ],
      valorActual: rho,
      estadoActual: rho >= 0.8 ? 'CRÍTICO' : rho >= 0.5 ? 'ADVERTENCIA' : 'ESTABLE'
    };
  }
}
