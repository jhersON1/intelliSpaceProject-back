// src/semantic-search/semantic-search.controller.ts
import { Controller, Get, Post, Query, Body } from '@nestjs/common';
import { SemanticSearchService } from './semantic-search.service';
import { EmbeddingService } from './services/embedding.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { ValidRoles } from '../auth/interfaces/valid-roles.interface';

@Controller('semantic-search')
export class SemanticSearchController {
  constructor(
    private readonly semanticSearchService: SemanticSearchService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  /**
   * Búsqueda semántica principal
   * GET /semantic-search?query=mesa bonita mediana para jardín&limit=10
   */
  @Get()
  async search(@Query() searchQuery: SearchQueryDto) {
    return await this.semanticSearchService.semanticSearch(searchQuery);
  }

  /**
   * Búsqueda semántica con POST (para consultas complejas)
   * POST /semantic-search/advanced
   */
  @Post('advanced')
  async advancedSearch(@Body() searchQuery: SearchQueryDto) {
    return await this.semanticSearchService.semanticSearch(searchQuery);
  }

  /**
   * Inicializar sistema de búsqueda semántica
   * GET /semantic-search/initialize
   */
  @Get('initialize')
  @Auth(ValidRoles.VENDOR) // Solo vendors pueden inicializar
  async initialize() {
    return await this.semanticSearchService.initializeSemanticSearch();
  }

  /**
   * Reindexar todos los productos
   * POST /semantic-search/reindex
   */
  @Post('reindex')
  @Auth(ValidRoles.VENDOR) // Solo vendors pueden reindexar
  async reindex() {
    return await this.semanticSearchService.reindexProducts();
  }

  /**
   * Obtener estadísticas del sistema de embeddings
   * GET /semantic-search/stats
   */
  @Get('stats')
  @Auth(ValidRoles.VENDOR)
  async getStats() {
    return await this.embeddingService.getEmbeddingStats();
  }

  /**
   * Verificar si un producto tiene embedding
   * GET /semantic-search/check/product-id
   */
  @Get('check/:productId')
  @Auth(ValidRoles.VENDOR)
  async checkProductEmbedding(@Query('productId') productId: string) {
    const hasEmbedding = await this.embeddingService.hasEmbedding(productId);
    return {
      productId,
      hasEmbedding,
      message: hasEmbedding ? 'Producto indexado' : 'Producto no indexado',
    };
  }
}
