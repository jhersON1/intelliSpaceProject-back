import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { SystemLoggerService } from '../services/system-logger.service';
import { LogLevel } from '../entities/system-log.entity';
import { Request } from 'express';

// Interface para request autenticado
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role?: string;
    [key: string]: any;
  };
}

@Injectable()
export class ErrorLoggingInterceptor implements NestInterceptor {
  constructor(private readonly systemLogger: SystemLoggerService) {}
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    return next.handle().pipe(
      catchError((error) => {
        // Solo loggear errores reales (4xx y 5xx)
        if (this.shouldLogError(error)) {
          this.logError(error, request).catch((logError) => {
            console.error('❌ Error logging failed:', logError);
          });
        }

        return throwError(() => error);
      }),
    );
  }

  private shouldLogError(error: any): boolean {
    // No loggear errores de validación comunes o 404
    if (error instanceof HttpException) {
      const status = error.getStatus();
      
      // Solo errores 500+ y algunos 4xx importantes
      return (
        status >= HttpStatus.INTERNAL_SERVER_ERROR || // 5xx
        status === HttpStatus.UNAUTHORIZED || // 401
        status === HttpStatus.FORBIDDEN // 403
      );
    }

    // Todos los otros errores no HTTP
    return true;
  }
  private async logError(error: any, request: AuthenticatedRequest): Promise<void> {
    const isHttpException = error instanceof HttpException;
    const status = isHttpException ? error.getStatus() : 500;
    const message = isHttpException 
      ? error.message 
      : 'Error interno del servidor';

    const level = status >= 500 ? LogLevel.ERROR : LogLevel.WARN;

    // Determinar contexto de negocio basado en el endpoint
    const businessContext = this.determineBusinessContext(request);

    await this.systemLogger.logError({
      level,
      message,
      stackTrace: error.stack,
      httpStatus: status,
      businessContext,
      errorContext: {
        errorType: error.constructor.name,
        isHttpException,
        originalMessage: error.message,
      },
    }, request);
  }

  /**
   * Determina el contexto de negocio basado en el endpoint y método
   */
  private determineBusinessContext(request: AuthenticatedRequest): string {
    const { method, originalUrl } = request;
    const url = originalUrl || request.url || '';

    // Mapear endpoints a contextos de negocio
    if (url.includes('/auth/login')) return 'User Login';
    if (url.includes('/auth/register')) return 'User Registration';
    if (url.includes('/auth/')) return 'Authentication';
    
    if (url.includes('/products') && method === 'POST') return 'Creating Product';
    if (url.includes('/products') && method === 'PUT') return 'Updating Product';
    if (url.includes('/products') && method === 'DELETE') return 'Deleting Product';
    if (url.includes('/products')) return 'Product Management';
    
    if (url.includes('/categories') && method === 'POST') return 'Creating Category';
    if (url.includes('/categories') && method === 'PUT') return 'Updating Category';
    if (url.includes('/categories') && method === 'DELETE') return 'Deleting Category';
    if (url.includes('/categories')) return 'Category Management';
    
    if (url.includes('/semantic-search')) return 'Semantic Search';
    if (url.includes('/visual-representation')) return 'Visual Representation';
    if (url.includes('/analytics')) return 'Analytics';
    if (url.includes('/messaging')) return 'Messaging';
    if (url.includes('/admin')) return 'Admin Operations';

    return `${method} ${url}`;
  }
}
