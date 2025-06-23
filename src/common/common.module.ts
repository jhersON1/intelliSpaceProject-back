import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { SystemLog } from './entities/system-log.entity';
import { SystemLoggerService } from './services/system-logger.service';
import { ErrorLoggingInterceptor } from './interceptors/error-logging.interceptor';

@Module({
  imports: [
    TypeOrmModule.forFeature([SystemLog]),
  ],
  providers: [
    SystemLoggerService,
    {
      provide: APP_INTERCEPTOR,
      useClass: ErrorLoggingInterceptor,
    },
  ],
  exports: [SystemLoggerService],
})
export class CommonModule {}
