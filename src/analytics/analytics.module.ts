import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './services/analytics.service';
import { QueueTheoryService } from './services/queue-theory.service';
import { HoltWintersService } from './services/holt-winters.service';
import { ProductAnalytics } from './entities/product-analytics.entity';
import { StockHistory } from './entities/stock-history.entity';
import { ClickTracking } from './entities/click-tracking.entity';
import { Product } from '../products/entities/product.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, QueueTheoryService, HoltWintersService],
  imports: [
    TypeOrmModule.forFeature([
      ProductAnalytics,
      StockHistory,
      ClickTracking,
      Product
    ]),
    AuthModule
  ],
  exports: [
    TypeOrmModule,
    AnalyticsService,
    QueueTheoryService,
    HoltWintersService
  ]
})
export class AnalyticsModule {}
