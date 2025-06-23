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
@Index(['traceId']) // Índice para búsqueda por trace ID
export class SystemLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { unique: true })
  traceId: string; // ID único para rastrear el request completo

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

  @Column('varchar', { nullable: true })
  userRole: string; // Rol del usuario (ADMIN, CONSUMER, VENDOR)

  @Column('varchar', { nullable: true })
  businessContext: string; // Contexto de negocio (ej: "Creating product", "User login")

  @Column('jsonb', { nullable: true })
  entityIds: Record<string, any>; // IDs de entidades involucradas

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
