// src/semantic-search/semantic-search.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { SemanticSearchController } from './semantic-search.controller';
import { SemanticSearchService } from './semantic-search.service';
import { OpenAIService } from './services/openai.service';
import { PineconeService } from './services/pinecone.service';
import { EmbeddingService } from './services/embedding.service';
import { ProductEmbedding } from './entities/product-embedding.entity';
import { Product } from '../products/entities/product.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  controllers: [SemanticSearchController],
  providers: [
    SemanticSearchService,
    OpenAIService,
    PineconeService,
    EmbeddingService,
  ],
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([ProductEmbedding, Product]),
    AuthModule,
  ],
  exports: [
    EmbeddingService,
    OpenAIService,
    PineconeService,
    SemanticSearchService,
  ],
})
export class SemanticSearchModule {}
