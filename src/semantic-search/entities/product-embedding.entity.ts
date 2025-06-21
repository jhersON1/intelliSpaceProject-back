// src/semantic-search/entities/product-embedding.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Product } from '../../products/entities/product.entity';

@Entity('product_embeddings')
export class ProductEmbedding {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  searchableText: string; // Texto concatenado: title + description + material + keywords

  @Column('text')
  pineconeId: string; // ID en Pinecone (ej: "product_uuid")

  @Column('text', { default: 'text-embedding-3-small' })
  embeddingModel: string; // Modelo de OpenAI usado

  @Column('int', { default: 1536 })
  embeddingDimensions: number; // Dimensiones del embedding

  @Column('json', { nullable: true })
  metadata: object; // Metadatos adicionales para Pinecone

  @Column('boolean', { default: true })
  isActive: boolean; // Para soft delete

  @OneToOne(() => Product, {
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  product: Product;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
