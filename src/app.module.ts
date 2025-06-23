import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { ProductsModule } from './products/products.module';
import { CategoriesModule } from './categories/categories.module';
import { ConnectionCloudinaryModule } from './connection-cloudinary/connection-cloudinary.module';
import { VisualRepresentationModule } from './visual-representation/visual-representation.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { SemanticSearchModule } from './semantic-search/semantic-search.module';
import { MessagingModule } from './messaging/messaging.module';
import { AdminModule } from './admin/admin.module';
import { databaseConfig } from './config/database.config';

@Module({
  imports: [
    ConfigModule.forRoot({ 
      isGlobal: true
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: () => databaseConfig(),
    }),
    AuthModule,
    CommonModule,
    ProductsModule,
    CategoriesModule,
    ConnectionCloudinaryModule,
    VisualRepresentationModule,
    AnalyticsModule,
    SemanticSearchModule,
    MessagingModule,
    AdminModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
