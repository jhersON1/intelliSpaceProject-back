import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { Consumer } from '../auth/entities/consumer.entity';
import { Vendor } from '../auth/entities/vendor.entity';
import { Product } from '../products/entities/product.entity';
import { Category } from '../categories/entities/category.entity';
import { Message } from '../messaging/entities/message.entity';
import { ProductEmbedding } from '../semantic-search/entities/product-embedding.entity';
import { VisualRepresentation } from '../visual-representation/entities/visual-representation.entity';
import { Image } from '../visual-representation/entities/image.entity';
import { Model3D } from '../visual-representation/entities/model3d.entity';
import { ExperienceAR } from '../visual-representation/entities/experiencia-ar.entity';
import { ProductAnalytics } from '../analytics/entities/product-analytics.entity';
import { StockHistory } from '../analytics/entities/stock-history.entity';
import { ClickTracking } from '../analytics/entities/click-tracking.entity';

export const databaseConfig = (): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'TesloDB',
  entities: [
    User, 
    Consumer, 
    Vendor, 
    Product, 
    Category, 
    Message,
    ProductEmbedding,
    VisualRepresentation,
    Image,
    Model3D,
    ExperienceAR,
    ProductAnalytics,
    StockHistory,
    ClickTracking
  ],
  synchronize: process.env.NODE_ENV !== 'production',
  logging: process.env.NODE_ENV === 'development',
  dropSchema: false,
  migrationsRun: false,
});
