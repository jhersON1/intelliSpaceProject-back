// src/semantic-search/dto/search-result.dto.ts
import { SemanticSearchResult } from '../interfaces/search.interface';

export class SearchResultDto {
  products: SemanticSearchResult[];
  totalFound: number;
  searchTime: number; // en milisegundos
  query: string;
  usedThreshold?: number; // 🆕 Threshold que se utilizó finalmente
  suggestions?: string[]; // Sugerencias si hay pocos resultados
}
