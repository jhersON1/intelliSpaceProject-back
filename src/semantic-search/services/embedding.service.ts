// src/semantic-search/services/embedding.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../../products/entities/product.entity';
import { ProductEmbedding } from '../entities/product-embedding.entity';
import { OpenAIService } from './openai.service';
import { PineconeService } from './pinecone.service';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductEmbedding)
    private readonly embeddingRepository: Repository<ProductEmbedding>,
    private readonly openaiService: OpenAIService,
    private readonly pineconeService: PineconeService,
  ) {}

  /**
   * Procesa un producto y crea su embedding
   * Se llama automáticamente cuando se crea/actualiza un producto
   */
  async processProduct(productId: string): Promise<void> {
    try {
      const product = await this.productRepository.findOne({
        where: { id: productId },
        relations: ['categories', 'vendor'],
      });

      if (!product) {
        throw new Error(`Producto ${productId} no encontrado`);
      }

      // Generar texto de búsqueda usando: title + description + material + keywords
      const searchableText = this.openaiService.generateSearchableText(product);

      this.logger.log(`Generando embedding para: "${searchableText}"`);

      // Generar embedding con OpenAI
      const embeddingVector = await this.openaiService.generateEmbedding(
        searchableText,
      );

      // Preparar metadatos para Pinecone
      const metadata = this.buildProductMetadata(product);

      // ID único para Pinecone
      const pineconeId = `product_${productId}`;

      // Guardar en Pinecone
      await this.pineconeService.upsertVector({
        id: pineconeId,
        values: embeddingVector,
        metadata,
      });

      // Guardar/actualizar en base de datos
      await this.saveProductEmbedding(product, searchableText, pineconeId);

      this.logger.log(`✅ Embedding procesado para: ${product.title}`);
    } catch (error) {
      this.logger.error(
        `❌ Error procesando producto ${productId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Elimina embedding de un producto
   * Se llama automáticamente cuando se elimina un producto
   */
  async deleteProductEmbedding(productId: string): Promise<void> {
    try {
      const embedding = await this.embeddingRepository.findOne({
        where: { product: { id: productId } },
      });

      if (embedding) {
        // Eliminar de Pinecone
        await this.pineconeService.deleteVector(embedding.pineconeId);

        // Eliminar de base de datos
        await this.embeddingRepository.remove(embedding);

        this.logger.log(`🗑️ Embedding eliminado para producto: ${productId}`);
      }
    } catch (error) {
      this.logger.error(
        `❌ Error eliminando embedding ${productId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Reindexar todos los productos existentes
   * Útil para la primera vez o cuando cambies el algoritmo
   */
  async reindexAllProducts(): Promise<{ processed: number; errors: number }> {
    try {
      this.logger.log('🔄 Iniciando reindexación de todos los productos...');

      // Crear índice en Pinecone si no existe
      await this.pineconeService.createIndexIfNotExists();

      const products = await this.productRepository.find({
        relations: ['categories', 'vendor'],
      });

      let processed = 0;
      let errors = 0;

      for (const product of products) {
        try {
          await this.processProduct(product.id);
          processed++;

          // Pausa pequeña para no sobrecargar las APIs
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
          this.logger.error(`Error procesando ${product.id}: ${error.message}`);
          errors++;
        }
      }

      this.logger.log(
        `✅ Reindexación completa: ${processed} procesados, ${errors} errores`,
      );

      return { processed, errors };
    } catch (error) {
      this.logger.error(`❌ Error en reindexación: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verifica si un producto tiene embedding
   */
  async hasEmbedding(productId: string): Promise<boolean> {
    const count = await this.embeddingRepository.count({
      where: {
        product: { id: productId },
        isActive: true,
      },
    });
    return count > 0;
  }

  /**
   * Obtiene estadísticas de embeddings
   */
  async getEmbeddingStats(): Promise<any> {
    const [totalEmbeddings, activeEmbeddings] = await Promise.all([
      this.embeddingRepository.count(),
      this.embeddingRepository.count({ where: { isActive: true } }),
    ]);

    return {
      database: {
        total: totalEmbeddings,
        active: activeEmbeddings,
        inactive: totalEmbeddings - activeEmbeddings,
      },
      model: {
        name: this.openaiService.getEmbeddingModel(),
        dimensions: this.openaiService.getEmbeddingDimensions(),
      },
    };
  }

  /**
   * Guarda/actualiza el embedding en la base de datos
   */
  private async saveProductEmbedding(
    product: Product,
    searchableText: string,
    pineconeId: string,
  ): Promise<void> {
    try {
      let embedding = await this.embeddingRepository.findOne({
        where: { product: { id: product.id } },
      });

      if (embedding) {
        // Actualizar existente
        embedding.searchableText = searchableText;
        embedding.pineconeId = pineconeId;
        embedding.embeddingModel = this.openaiService.getEmbeddingModel();
        embedding.embeddingDimensions =
          this.openaiService.getEmbeddingDimensions();
        embedding.isActive = true;
      } else {
        // Crear nuevo
        embedding = this.embeddingRepository.create({
          product,
          searchableText,
          pineconeId,
          embeddingModel: this.openaiService.getEmbeddingModel(),
          embeddingDimensions: this.openaiService.getEmbeddingDimensions(),
          isActive: true,
        });
      }

      await this.embeddingRepository.save(embedding);
    } catch (error) {
      this.logger.error(
        `Error guardando embedding para ${product.id}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Construye metadatos para Pinecone
   */
  private buildProductMetadata(product: Product): Record<string, any> {
    return {
      productId: product.id,
      title: product.title,
      price: product.price,
      inStock: product.stock > 0,
      vendorId: product.vendor?.id,
      vendorName: product.vendor?.nameBusiness,
      categories: product.categories?.map((cat) => cat.name) || [],
      categoryIds: product.categories?.map((cat) => cat.id) || [],
      material: product.material,
      state: product.state,
      datePublication: product.datePublication?.toISOString(),
    };
  }
}
