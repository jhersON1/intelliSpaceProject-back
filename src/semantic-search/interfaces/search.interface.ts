// src/semantic-search/interfaces/search.interface.ts
export interface SemanticSearchResult {
  product: any;
  score: number;
  relevance: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface SearchFilters {
  categories?: string[];
  priceRange?: {
    min?: number;
    max?: number;
  };
  vendorId?: string;
  inStock?: boolean;
}
