// src/semantic-search/services/openai.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);
  private readonly openai: OpenAI;
  private readonly embeddingModel = 'text-embedding-3-small';

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');

    if (!apiKey) {
      throw new Error(
        'OPENAI_API_KEY no está configurado en las variables de entorno',
      );
    }

    this.openai = new OpenAI({
      apiKey: apiKey,
    });
  }

  /**
   * Genera embedding para un texto dado
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const cleanText = text.replace(/\n/g, ' ').trim();

      const response = await this.openai.embeddings.create({
        model: this.embeddingModel,
        input: cleanText,
      });

      return response.data[0].embedding;
    } catch (error) {
      this.logger.error(`Error generando embedding: ${error.message}`);
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }

  /**
   * Genera texto de búsqueda para un producto
   * Solo usa: title + description + material + keywords
   */
  generateSearchableText(product: any): string {
    const parts = [
      product.title,
      product.description,
      product.material,
      product.keywords?.join(' '),
    ].filter(Boolean); // Filtra valores null/undefined

    return parts.join(' ').toLowerCase().trim();
  }

  /**
   * Obtiene el modelo de embedding usado
   */
  getEmbeddingModel(): string {
    return this.embeddingModel;
  }

  /**
   * Obtiene las dimensiones del embedding
   */
  getEmbeddingDimensions(): number {
    return 1536; // text-embedding-3-small tiene 1536 dimensiones
  }
}
