import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessagingService } from './messaging.service';
import { MessagingController } from './messaging.controller';
import { Message } from './entities/message.entity';
import { Consumer } from '../auth/entities/consumer.entity';
import { Vendor } from '../auth/entities/vendor.entity';
import { Product } from '../products/entities/product.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message, Consumer, Vendor, Product]),
    AuthModule
  ],
  controllers: [MessagingController],
  providers: [MessagingService],
  exports: [MessagingService]
})
export class MessagingModule {}
