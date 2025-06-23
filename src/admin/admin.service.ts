import { Injectable } from '@nestjs/common';
import { SystemLoggerService } from '../common/services/system-logger.service';
import { LogLevel } from '../common/entities/system-log.entity';

export interface LogFilters {
  level?: LogLevel;
  startDate?: string;
  endDate?: string;
  limit?: number;
  page?: number;
  resolved?: boolean;
  search?: string;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly systemLogger: SystemLoggerService,
  ) {}
  /**
   * Obtiene logs para el dashboard
   */
  async getLogs(filters: LogFilters) {
    const limit = filters.limit || 20;
    const page = filters.page || 1;
    const offset = (page - 1) * limit;

    const parsedFilters = {
      level: filters.level,
      startDate: filters.startDate ? new Date(filters.startDate) : undefined,
      endDate: filters.endDate ? new Date(filters.endDate) : undefined,
      resolved: filters.resolved,
      search: filters.search,
      limit,
      offset,
    };

    const result = await this.systemLogger.getLogs(parsedFilters);      // Convertir a formato esperado por frontend
    return {
      logs: result.logs.map(log => ({
        id: log.id,
        traceId: log.traceId,
        level: log.level,
        message: log.message,
        context: log.endpoint, // Usar endpoint como contexto
        details: log.errorContext, // Mapear errorContext a details
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        endpoint: log.endpoint,
        method: log.method,
        userId: log.userId,
        userRole: log.userRole,
        businessContext: log.businessContext,
        entityIds: log.entityIds,
        stackTrace: log.stackTrace,
        errorContext: log.errorContext,
        timestamp: log.createdAt,
        resolved: log.isResolved,
        resolvedAt: log.resolvedAt,
        resolvedBy: log.resolvedBy,
      })),
      total: result.totalCount,
      page: page,
      limit: limit,
      totalPages: Math.ceil(result.totalCount / limit),
    };
  }

  /**
   * Obtiene estadísticas del dashboard
   */
  async getDashboardStats() {
    return await this.systemLogger.getLogStats();
  }

  /**
   * Marca un log como resuelto
   */
  async resolveLog(logId: string, adminEmail: string) {
    await this.systemLogger.markAsResolved(logId, adminEmail);
    return { message: 'Log marcado como resuelto' };
  }
}
