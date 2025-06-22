import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, LessThan } from 'typeorm';
import { SystemLog, LogLevel } from '../entities/system-log.entity';
import { Request } from 'express';

// Extender el tipo Request para incluir user
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    [key: string]: any;
  };
}

export interface LogData {
  level: LogLevel;
  message: string;
  stackTrace?: string;
  endpoint?: string;
  method?: string;
  ipAddress?: string;
  userAgent?: string;
  userId?: string;
  userEmail?: string;
  requestData?: Record<string, any>;
  errorContext?: Record<string, any>;
  httpStatus?: number;
}

@Injectable()
export class SystemLoggerService {
  constructor(
    @InjectRepository(SystemLog)
    private readonly systemLogRepository: Repository<SystemLog>,
  ) {}
  /**
   * Registra un error en el sistema
   */
  async logError(data: LogData, req?: AuthenticatedRequest): Promise<SystemLog> {
    const logEntry = this.systemLogRepository.create({
      ...data,
      level: LogLevel.ERROR,
      ...this.extractRequestInfo(req),
    });

    const savedLog = await this.systemLogRepository.save(logEntry);
    
    // También logear en consola para desarrollo
    console.error('🔴 SYSTEM ERROR LOGGED:', {
      id: savedLog.id,
      message: data.message,
      endpoint: data.endpoint,
      userId: data.userId,
      timestamp: savedLog.createdAt,
    });

    return savedLog;
  }
  /**
   * Registra un warning en el sistema
   */
  async logWarning(data: LogData, req?: AuthenticatedRequest): Promise<SystemLog> {
    const logEntry = this.systemLogRepository.create({
      ...data,
      level: LogLevel.WARN,
      ...this.extractRequestInfo(req),
    });

    const savedLog = await this.systemLogRepository.save(logEntry);
    
    // También logear en consola para desarrollo
    console.warn('🟡 SYSTEM WARNING LOGGED:', {
      id: savedLog.id,
      message: data.message,
      endpoint: data.endpoint,
      userId: data.userId,
      timestamp: savedLog.createdAt,
    });

    return savedLog;
  }
  /**
   * Registra un error desde una excepción
   */
  async logException(
    error: Error,
    message: string,
    req?: AuthenticatedRequest,
    context?: Record<string, any>,
  ): Promise<SystemLog> {
    return this.logError({
      level: LogLevel.ERROR,
      message,
      stackTrace: error.stack,
      errorContext: {
        errorName: error.name,
        errorMessage: error.message,
        ...context,
      },
      httpStatus: 500,
    }, req);
  }
  /**
   * Obtiene logs con filtros para el dashboard admin
   */
  async getLogs(filters: {
    level?: LogLevel;
    startDate?: Date;
    endDate?: Date;
    resolved?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const queryBuilder = this.systemLogRepository.createQueryBuilder('log');

    if (filters.level) {
      queryBuilder.andWhere('log.level = :level', { level: filters.level });
    }

    if (filters.startDate) {
      queryBuilder.andWhere('log.createdAt >= :startDate', { 
        startDate: filters.startDate 
      });
    }

    if (filters.endDate) {
      queryBuilder.andWhere('log.createdAt <= :endDate', { 
        endDate: filters.endDate 
      });
    }

    if (filters.resolved !== undefined) {
      queryBuilder.andWhere('log.isResolved = :resolved', { 
        resolved: filters.resolved 
      });
    }    if (filters.search) {
      queryBuilder.andWhere(
        '(log.message ILIKE :search OR log.endpoint ILIKE :search OR log.userEmail ILIKE :search)',
        { search: `%${filters.search}%` }
      );
    }

    const totalCount = await queryBuilder.getCount();

    const logs = await queryBuilder
      .orderBy('log.createdAt', 'DESC')
      .limit(filters.limit || 50)
      .offset(filters.offset || 0)
      .getMany();

    return {
      logs,
      totalCount,
      hasMore: (filters.offset || 0) + logs.length < totalCount,
    };
  }

  /**
   * Marca un log como resuelto
   */
  async markAsResolved(logId: string, adminEmail: string): Promise<void> {
    await this.systemLogRepository.update(logId, {
      isResolved: true,
      resolvedBy: adminEmail,
      resolvedAt: new Date(),
    });
  }  /**
   * Obtiene estadísticas de logs
   */  
  async getLogStats() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [
      totalLogs,
      errorCount,
      warningCount,
      unresolvedCount,
      unresolvedErrors,
      resolvedCount,
      logsToday,
      logsThisWeek,
    ] = await Promise.all([
      this.systemLogRepository.count(),
      this.systemLogRepository.count({ where: { level: LogLevel.ERROR } }),
      this.systemLogRepository.count({ where: { level: LogLevel.WARN } }),
      this.systemLogRepository.count({
        where: {
          isResolved: false,
        },
      }),
      this.systemLogRepository.count({
        where: {
          level: LogLevel.ERROR,
          isResolved: false,
        },
      }),
      this.systemLogRepository.count({
        where: {
          isResolved: true,
        },
      }),
      this.systemLogRepository.count({
        where: {
          createdAt: MoreThanOrEqual(today),
        },
      }),
      this.systemLogRepository.count({
        where: {
          createdAt: MoreThanOrEqual(weekAgo),
        },
      }),
    ]);

    return {
      totalLogs,
      errorCount,
      warningCount,
      unresolvedCount,
      unresolvedErrors,
      resolvedCount,
      logsToday,
      logsThisWeek,
    };
  }
  /**
   * Extrae información del request
   */
  private extractRequestInfo(req?: AuthenticatedRequest) {
    if (!req) return {};

    // Extraer datos del request sin incluir passwords
    const requestData = { ...req.body };
    if (requestData.password) delete requestData.password;
    if (requestData.confirmPassword) delete requestData.confirmPassword;    return {
      endpoint: req.originalUrl || req.url,
      method: req.method,
      ipAddress: this.getClientIP(req),
      userAgent: req.get('User-Agent'),
      requestData: Object.keys(requestData).length > 0 ? requestData : undefined,
      userId: req.user?.id || undefined,
      userEmail: req.user?.email || undefined,
    };
  }
  /**
   * Obtiene la IP real del cliente
   */
  private getClientIP(req: AuthenticatedRequest): string {
    return (
      req.ip ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      req.headers['x-forwarded-for']?.toString().split(',')[0] ||
      req.headers['x-real-ip']?.toString() ||
      'unknown'
    );
  }
}
