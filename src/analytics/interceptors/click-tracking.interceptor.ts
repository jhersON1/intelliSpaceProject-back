import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AnalyticsService } from '../services/analytics.service';

@Injectable()
export class ClickTrackingInterceptor implements NestInterceptor {
  constructor(private readonly analyticsService: AnalyticsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Solo trackear en endpoints específicos de productos
    const isProductEndpoint = request.url.includes('/products/') && request.method === 'GET';
    
    if (!isProductEndpoint) {
      return next.handle();
    }

    // Extraer productId de la URL
    const urlParts = request.url.split('/');
    const productIdIndex = urlParts.indexOf('products') + 1;
    const productId = urlParts[productIdIndex];

    // Validar UUID format básico
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(productId)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(async () => {
        // Solo trackear si la respuesta fue exitosa
        if (response.statusCode >= 200 && response.statusCode < 300) {
          try {
            await this.analyticsService.trackProductInteraction({
              productId,
              userIp: this.getClientIp(request),
              userAgent: request.headers['user-agent'],
              interactionType: 'VIEW',
              referrer: request.headers['referer'],
              duration: 1
            });
          } catch (error) {
            console.log('Error en tracking automático:', error);
            // No fallar la request original por errores de tracking
          }
        }
      })
    );
  }

  private getClientIp(request: any): string {
    return request.headers['x-forwarded-for'] || 
           request.headers['x-real-ip'] || 
           request.connection.remoteAddress || 
           request.socket.remoteAddress ||
           (request.connection.socket ? request.connection.socket.remoteAddress : null) ||
           'unknown';
  }
}
