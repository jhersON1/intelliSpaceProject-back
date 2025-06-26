import { Module, forwardRef } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { AuthModule } from '../auth/auth.module';
import { CategoriesModule } from '../categories/categories.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { SemanticSearchModule } from '../semantic-search/semantic-search.module'; // NUEVO

@Module({
  controllers: [ProductsController],
  providers: [ProductsService],
  imports: [
    TypeOrmModule.forFeature([Product]),
    AuthModule,
    CategoriesModule,
    AnalyticsModule,
    forwardRef(() => SemanticSearchModule), // NUEVO - forwardRef para evitar dependencias circulares
  ],
  exports: [TypeOrmModule],
})
export class ProductsModule {}
