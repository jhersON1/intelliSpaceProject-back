import { Module } from '@nestjs/common';
import { ConnectionCloudinaryService } from './connection-cloudinary.service';
import { ConnectionCloudinaryController } from './connection-cloudinary.controller';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  controllers: [ConnectionCloudinaryController],
  providers: [ConnectionCloudinaryService],
  exports: [ConnectionCloudinaryService],
})
export class ConnectionCloudinaryModule {}
