import { Test, TestingModule } from '@nestjs/testing';
import { SemanticSearchService } from './semantic-search.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Product } from '../products/entities/product.entity';
import { OpenAIService } from './services/openai.service';
import { PineconeService } from './services/pinecone.service';
import { EmbeddingService } from './services/embedding.service';

describe('SemanticSearchService - Pure Functions', () => {
  let service: SemanticSearchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SemanticSearchService,
        {
          provide: getRepositoryToken(Product),
          useValue: {}, // Mock repository
        },
        {
          provide: OpenAIService,
          useValue: {}, // Mock service
        },
        {
          provide: PineconeService,
          useValue: {}, // Mock service
        },
        {
          provide: EmbeddingService,
          useValue: {}, // Mock service
        },
      ],
    }).compile();

    service = module.get<SemanticSearchService>(SemanticSearchService);
  });

  describe('calculateRelevance', () => {
    it('should return HIGH for scores >= 0.7', () => {
      // Acceder al método privado para testing
      const calculateRelevance = (service as any).calculateRelevance.bind(service);
      
      const highScores = [0.7, 0.8, 0.9, 1.0, 0.75, 0.99];
      
      highScores.forEach(score => {
        const result = calculateRelevance(score);
        expect(result).toBe('HIGH');
      });
    });

    it('should return MEDIUM for scores >= 0.5 and < 0.7', () => {
      const calculateRelevance = (service as any).calculateRelevance.bind(service);
      
      const mediumScores = [0.5, 0.6, 0.65, 0.69, 0.55];
      
      mediumScores.forEach(score => {
        const result = calculateRelevance(score);
        expect(result).toBe('MEDIUM');
      });
    });

    it('should return LOW for scores < 0.5', () => {
      const calculateRelevance = (service as any).calculateRelevance.bind(service);
      
      const lowScores = [0, 0.1, 0.3, 0.49, 0.45, 0.2];
      
      lowScores.forEach(score => {
        const result = calculateRelevance(score);
        expect(result).toBe('LOW');
      });
    });

    it('should handle edge cases and boundary values', () => {
      const calculateRelevance = (service as any).calculateRelevance.bind(service);
      
      // Valores límite exactos
      expect(calculateRelevance(0.7)).toBe('HIGH');
      expect(calculateRelevance(0.5)).toBe('MEDIUM');
      
      // Justo por debajo de los límites
      expect(calculateRelevance(0.6999)).toBe('MEDIUM');
      expect(calculateRelevance(0.4999)).toBe('LOW');
      
      // Valores extremos
      expect(calculateRelevance(0)).toBe('LOW');
      expect(calculateRelevance(1.0)).toBe('HIGH');
    });

    it('should handle decimal precision correctly', () => {
      const calculateRelevance = (service as any).calculateRelevance.bind(service);
      
      // Pruebas con decimales que podrían causar problemas de precisión
      expect(calculateRelevance(0.5000000001)).toBe('MEDIUM');
      expect(calculateRelevance(0.7000000001)).toBe('HIGH');
      expect(calculateRelevance(0.4999999999)).toBe('LOW');
      expect(calculateRelevance(0.6999999999)).toBe('MEDIUM');
    });

    it('should handle negative values', () => {
      const calculateRelevance = (service as any).calculateRelevance.bind(service);
      
      const negativeScores = [-0.1, -1, -0.5];
      
      negativeScores.forEach(score => {
        const result = calculateRelevance(score);
        expect(result).toBe('LOW');
      });
    });

    it('should handle values greater than 1', () => {
      const calculateRelevance = (service as any).calculateRelevance.bind(service);
      
      const highValues = [1.1, 2.0, 10.5];
      
      highValues.forEach(score => {
        const result = calculateRelevance(score);
        expect(result).toBe('HIGH');
      });
    });
  });
});
