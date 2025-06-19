// src/semantic-search/interfaces/embedding.interface.ts
export interface EmbeddingVector {
  id: string;
  values: number[];
  metadata?: Record<string, any>;
}

export interface SearchMatch {
  id: string;
  score: number;
  metadata?: Record<string, any>;
}
