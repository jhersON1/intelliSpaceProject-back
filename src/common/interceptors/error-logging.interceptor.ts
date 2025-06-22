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

    await this.systemLogger.logError({
      level,
      message,
      stackTrace: error.stack,
      httpStatus: status,
      errorContext: {
        errorType: error.constructor.name,
        isHttpException,
        originalMessage: error.message,
      },
    }, request);
  }
}
