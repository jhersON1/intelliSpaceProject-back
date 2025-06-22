import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
}

@Entity('system_logs')
@Index(['level', 'createdAt']) // Índice para consultas frecuentes
@Index(['createdAt']) // Índice para filtros por fecha
export class SystemLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: LogLevel,
  })
  level: LogLevel;

  @Column('text')
  message: string;

  @Column('text', { nullable: true })
  stackTrace: string;

  @Column('varchar', { nullable: true })
  endpoint: string;

  @Column('varchar', { nullable: true })
  method: string; // GET, POST, etc.

  @Column('varchar', { nullable: true })
  ipAddress: string;

  @Column('text', { nullable: true })
  userAgent: string;

  @Column('uuid', { nullable: true })
  userId: string;

  @Column('varchar', { nullable: true })
  userEmail: string;

  @Column('jsonb', { nullable: true })
  requestData: Record<string, any>; // Request body (sin passwords)

  @Column('jsonb', { nullable: true })
  errorContext: Record<string, any>; // Contexto adicional del error

  @Column('int', { nullable: true })
  httpStatus: number;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ default: false })
  isResolved: boolean; // Para marcar errores como resueltos

  @Column('text', { nullable: true })
  resolvedBy: string; // Admin que marcó como resuelto

  @Column('timestamp', { nullable: true })
  resolvedAt: Date;
}
