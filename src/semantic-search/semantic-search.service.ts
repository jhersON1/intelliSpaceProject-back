// src/semantic-search/semantic-search.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../products/entities/product.entity';
import { OpenAIService } from './services/openai.service';
import { PineconeService } from './services/pinecone.service';
import { EmbeddingService } from './services/embedding.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchResultDto } from './dto/search-result.dto';
import { SemanticSearchResult } from './interfaces/search.interface';

@Injectable()
export class SemanticSearchService {
  private readonly logger = new Logger(SemanticSearchService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly openaiService: OpenAIService,
    private readonly pineconeService: PineconeService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  /**
   * Filtrado inteligente: Se queda solo con los productos más relevantes
   * Si hay una diferencia significativa en scores, descarta los menos relevantes
   */
  private intelligentFilter(
    results: SemanticSearchResult[],
  ): SemanticSearchResult[] {
    if (results.length <= 1) return results;

    // Ordenar por score descendente
    const sortedResults = [...results].sort((a, b) => b.score - a.score);

    const bestScore = sortedResults[0].score;
    const worstScore = sortedResults[sortedResults.length - 1].score;
    const scoreDifference = bestScore - worstScore;

    this.logger.log(
      `📊 Análisis de scores: Mejor ${bestScore.toFixed(
        4,
      )}, Peor ${worstScore.toFixed(4)}, Diferencia ${scoreDifference.toFixed(
        4,
      )}`,
    );

    // Si la diferencia es grande (>0.08), quedarse solo con los mejores
    if (scoreDifference > 0.08) {
      // Calcular threshold dinámico: mejor score - 0.05
      const dynamicThreshold = bestScore - 0.05;
      const filteredResults = sortedResults.filter(
        (result) => result.score >= dynamicThreshold,
      );

      this.logger.log(
        `🎯 Diferencia significativa detectada (${scoreDifference.toFixed(
          4,
        )} > 0.08). Filtro dinámico: ${dynamicThreshold.toFixed(4)}`,
      );
      this.logger.log(
        `🔥 Productos seleccionados: ${filteredResults.length} (antes: ${sortedResults.length})`,
      );

      return filteredResults.slice(0, 2); // Máximo 2 productos de alta calidad
    }

    // Si los scores son similares, devolver todos (pero máximo 5)
    this.logger.log(`✅ Scores similares, devolviendo todos los productos`);
    return sortedResults.slice(0, 5);
  }

  /**
   * Búsqueda semántica adaptativa
   * Comienza con similitud alta (0.7) y baja gradualmente hasta encontrar resultados
   */
  async semanticSearch(searchQuery: SearchQueryDto): Promise<SearchResultDto> {
    const startTime = Date.now();

    try {
      this.logger.log(`🔍 Búsqueda semántica: "${searchQuery.query}"`);

      // 1. Generar embedding de la consulta
      const queryEmbedding = await this.openaiService.generateEmbedding(
        searchQuery.query,
      );
      this.logger.log(`✅ Embedding generado para consulta`);

      // 2. Construir filtros para Pinecone
      const filters = this.pineconeService.buildPineconeFilter({
        categories: searchQuery.categories,
        vendorId: searchQuery.vendorId,
        inStock: searchQuery.inStock,
        minPrice: searchQuery.minPrice,
        maxPrice: searchQuery.maxPrice,
      });

      // 3. Buscar en Pinecone (obtenemos más resultados para el filtrado adaptativo)
      const matches = await this.pineconeService.searchSimilar(
        queryEmbedding,
        Math.max(searchQuery.limit || 10, 20), // Obtenemos más para filtrar
        Object.keys(filters).length > 0 ? filters : undefined,
      );

      this.logger.log(`🔍 Pinecone encontró ${matches.length} matches`);

      // 4. BÚSQUEDA ADAPTATIVA: Intentar diferentes thresholds
      let semanticResults: SemanticSearchResult[] = [];
      let usedThreshold = 0;

      // Si el usuario especifica minSimilarity, lo respetamos
      if (searchQuery.minSimilarity !== undefined) {
        const result = await this.processMatches(
          matches,
          searchQuery.minSimilarity,
          searchQuery.limit || 10,
        );
        semanticResults = result.results;
        usedThreshold = searchQuery.minSimilarity;
        this.logger.log(`🎯 Usando threshold personalizado: ${usedThreshold}`);

        // 🆕 APLICAR FILTRADO INTELIGENTE TAMBIÉN AQUÍ
        if (semanticResults.length > 1) {
          semanticResults = this.intelligentFilter(semanticResults);
          this.logger.log(
            `🧠 Filtrado inteligente aplicado: ${semanticResults.length} productos finales`,
          );
        }
      } else {
        // Búsqueda adaptativa inteligente
        const thresholds = [0.7, 0.6, 0.5, 0.4, 0.3];

        for (const threshold of thresholds) {
          this.logger.log(`🔄 Probando threshold: ${threshold}`);

          const result = await this.processMatches(
            matches,
            threshold,
            searchQuery.limit || 10,
          );

          if (result.results.length >= 3) {
            // Encontramos suficientes resultados de buena calidad
            semanticResults = result.results;
            usedThreshold = threshold;
            this.logger.log(
              `✅ Threshold exitoso: ${threshold} (${result.results.length} productos)`,
            );
            break;
          } else if (
            result.results.length > 0 &&
            semanticResults.length === 0
          ) {
            // Guardamos estos resultados como backup
            semanticResults = result.results;
            usedThreshold = threshold;
            this.logger.log(
              `⚠️ Backup con threshold: ${threshold} (${result.results.length} productos)`,
            );
          }
        }

        // 🆕 FILTRADO INTELIGENTE: Si hay una diferencia significativa en scores,
        // quedarse solo con los mejores
        if (semanticResults.length > 1) {
          semanticResults = this.intelligentFilter(semanticResults);
          this.logger.log(
            `🧠 Filtrado inteligente: ${semanticResults.length} productos finales`,
          );
        }

        if (semanticResults.length === 0) {
          this.logger.warn(
            `🚫 No se encontraron resultados con ningún threshold`,
          );
        }
      }

      const searchTime = Date.now() - startTime;

      this.logger.log(
        `✅ Búsqueda completada: ${semanticResults.length} productos en ${searchTime}ms (threshold: ${usedThreshold})`,
      );

      return {
        products: semanticResults,
        totalFound: semanticResults.length,
        searchTime,
        query: searchQuery.query,
        usedThreshold, // 🆕 Agregamos el threshold usado
        suggestions: await this.generateSuggestions(
          searchQuery.query,
          semanticResults.length,
        ),
      };
    } catch (error) {
      this.logger.error(`❌ Error en búsqueda semántica: ${error.message}`);
      this.logger.error(`Stack trace: ${error.stack}`);
      throw error;
    }
  }

  /**
   * Procesa los matches con un threshold específico
   */
  private async processMatches(
    matches: any[],
    threshold: number,
    limit: number,
  ): Promise<{ results: SemanticSearchResult[]; count: number }> {
    // Filtrar por threshold
    const filteredMatches = matches.filter((match) => match.score >= threshold);

    this.logger.log(
      `📊 Threshold ${threshold}: ${filteredMatches.length}/${matches.length} matches`,
    );

    if (filteredMatches.length === 0) {
      return { results: [], count: 0 };
    }

    // Log de scores para debugging
    filteredMatches.slice(0, 5).forEach((match, index) => {
      this.logger.log(
        `  Match ${index + 1}: Score ${match.score.toFixed(4)} - ${
          match.metadata?.title || 'Sin título'
        }`,
      );
    });

    // Obtener IDs de productos
    const productIds = filteredMatches
      .map((match) => match.metadata?.productId)
      .filter((id): id is string => Boolean(id))
      .slice(0, limit); // Limitar aquí para optimizar la consulta DB

    this.logger.log(
      `📋 IDs de productos (${threshold}): ${productIds.length} únicos`,
    );

    if (productIds.length === 0) {
      return { results: [], count: 0 };
    }

    // Buscar productos en la base de datos
    const products = await this.productRepository.find({
      where: productIds.map((id) => ({ id })),
      relations: ['categories', 'vendor', 'visualRepresentations'],
    });

    this.logger.log(
      `📦 Productos encontrados en DB (${threshold}): ${products.length}`,
    );

    // Combinar productos con scores
    const semanticResults: SemanticSearchResult[] = filteredMatches
      .slice(0, limit) // Aplicar limit final
      .map((match) => {
        const product = products.find(
          (p) => p.id === match.metadata?.productId,
        );
        if (!product) {
          this.logger.warn(
            `⚠️ Producto no encontrado en DB: ${match.metadata?.productId}`,
          );
          return null;
        }

        return {
          product,
          score: match.score,
          relevance: this.calculateRelevance(match.score),
        };
      })
      .filter((result): result is SemanticSearchResult => result !== null);

    // Ordenar por score descendente
    semanticResults.sort((a, b) => b.score - a.score);

    return { results: semanticResults, count: semanticResults.length };
  }

  /**
   * Inicializar sistema de búsqueda semántica
   */
  async initializeSemanticSearch(): Promise<{ message: string; stats: any }> {
    try {
      this.logger.log('🚀 Inicializando sistema de búsqueda semántica...');

      // Crear índice en Pinecone si no existe
      await this.pineconeService.createIndexIfNotExists();

      // Obtener estadísticas
      const stats = await this.embeddingService.getEmbeddingStats();

      return {
        message: 'Sistema de búsqueda semántica inicializado correctamente',
        stats,
      };
    } catch (error) {
      this.logger.error(`❌ Error inicializando: ${error.message}`);
      throw error;
    }
  }

  /**
   * Reindexar todos los productos
   */
  async reindexProducts(): Promise<{ message: string; results: any }> {
    try {
      this.logger.log('🔄 Iniciando reindexación de productos...');

      const results = await this.embeddingService.reindexAllProducts();

      return {
        message: 'Reindexación completada',
        results,
      };
    } catch (error) {
      this.logger.error(`❌ Error en reindexación: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calcula el nivel de relevancia basado en el score
   */
  private calculateRelevance(score: number): 'HIGH' | 'MEDIUM' | 'LOW' {
    if (score >= 0.7) return 'HIGH';
    if (score >= 0.5) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Genera sugerencias de búsqueda si hay pocos resultados
   */
  private async generateSuggestions(
    query: string,
    resultCount: number,
  ): Promise<string[] | undefined> {
    if (resultCount >= 3) return undefined;

    // Sugerencias básicas si hay pocos resultados
    const suggestions: string[] = [];

    if (query.includes('mesa')) {
      suggestions.push('mesa de comedor', 'mesa de centro', 'mesa de jardín');
    }
    if (query.includes('silla')) {
      suggestions.push(
        'silla de oficina',
        'silla de comedor',
        'silla ejecutiva',
      );
    }
    if (query.includes('sofá') || query.includes('sofa')) {
      suggestions.push('sofá de sala', 'sofá cama', 'sofá esquinero');
    }

    return suggestions.length > 0
      ? suggestions
      : ['muebles de sala', 'muebles de oficina', 'muebles de jardín'];
  }
}
