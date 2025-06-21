// src/semantic-search/services/pinecone.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pinecone } from '@pinecone-database/pinecone';
import {
  EmbeddingVector,
  SearchMatch,
} from '../interfaces/embedding.interface';

@Injectable()
export class PineconeService implements OnModuleInit {
  private readonly logger = new Logger(PineconeService.name);
  private pinecone: Pinecone;
  private index: any;
  private readonly indexName: string;

  constructor(private readonly configService: ConfigService) {
    this.indexName =
      this.configService.get<string>('PINECONE_INDEX_NAME') ??
      'intellispace-furniture';
  }

  async onModuleInit() {
    await this.initializePinecone();
  }

  private async initializePinecone() {
    try {
      const apiKey = this.configService.get<string>('PINECONE_API_KEY');

      if (!apiKey) {
        throw new Error(
          'PINECONE_API_KEY no está configurado en las variables de entorno',
        );
      }

      this.pinecone = new Pinecone({
        apiKey: apiKey,
      });

      this.index = this.pinecone.index(this.indexName);

      this.logger.log(`Pinecone inicializado con índice: ${this.indexName}`);
    } catch (error) {
      this.logger.error(`Error inicializando Pinecone: ${error.message}`);
      throw error;
    }
  }

  /**
   * Crea el índice si no existe
   */
  async createIndexIfNotExists(dimension: number = 1536) {
    try {
      const indexes = await this.pinecone.listIndexes();
      const indexExists = indexes.indexes?.some(
        (idx) => idx.name === this.indexName,
      );

      if (!indexExists) {
        this.logger.log(`Creando índice: ${this.indexName}`);

        await this.pinecone.createIndex({
          name: this.indexName,
          dimension: dimension,
          metric: 'cosine',
          spec: {
            serverless: {
              cloud: 'aws',
              region: 'us-east-1',
            },
          },
        });

        // Esperar a que el índice esté listo
        await this.waitForIndexReady();
      } else {
        this.logger.log(`Índice ${this.indexName} ya existe`);
      }
    } catch (error) {
      this.logger.error(`Error creando índice: ${error.message}`);
      throw error;
    }
  }

  private async waitForIndexReady(maxWaitTime = 60000) {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const indexStats = await this.index.describeIndexStats();
        if (indexStats) {
          this.logger.log('Índice de Pinecone listo');
          return;
        }
      } catch (error) {
        // Índice aún no está listo
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    throw new Error('Timeout esperando que el índice esté listo');
  }

  /**
   * Inserta o actualiza un vector en Pinecone
   */
  async upsertVector(vector: EmbeddingVector): Promise<void> {
    try {
      await this.index.upsert([
        {
          id: vector.id,
          values: vector.values,
          metadata: vector.metadata || {},
        },
      ]);
    } catch (error) {
      this.logger.error(
        `Error insertando vector ${vector.id}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Busca vectores similares
   */
  async searchSimilar(
    queryVector: number[],
    topK: number = 10,
    filter?: Record<string, any>,
  ): Promise<SearchMatch[]> {
    try {
      const searchRequest: any = {
        vector: queryVector,
        topK,
        includeMetadata: true,
        includeValues: false,
      };

      if (filter) {
        searchRequest.filter = filter;
      }

      const response = await this.index.query(searchRequest);

      return (
        response.matches?.map((match) => ({
          id: match.id,
          score: match.score,
          metadata: match.metadata,
        })) || []
      );
    } catch (error) {
      this.logger.error(`Error buscando vectores similares: ${error.message}`);
      throw error;
    }
  }

  /**
   * Elimina un vector
   */
  async deleteVector(id: string): Promise<void> {
    try {
      await this.index.deleteOne(id);
    } catch (error) {
      this.logger.error(`Error eliminando vector ${id}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Construye filtros para Pinecone
   */
  buildPineconeFilter(filters: any): Record<string, any> {
    const filter: Record<string, any> = {};

    if (filters.categories && filters.categories.length > 0) {
      filter.category = { $in: filters.categories };
    }

    if (filters.vendorId) {
      filter.vendorId = filters.vendorId;
    }

    if (filters.inStock) {
      filter.inStock = true;
    }

    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      filter.price = {};
      if (filters.minPrice !== undefined) {
        filter.price.$gte = filters.minPrice;
      }
      if (filters.maxPrice !== undefined) {
        filter.price.$lte = filters.maxPrice;
      }
    }

    return filter;
  }
}
