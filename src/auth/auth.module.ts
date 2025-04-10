import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Consumer, User, Vendor } from './entities';

@Module({
  controllers: [AuthController],
  providers: [AuthService],
  imports: [TypeOrmModule.forFeature([User, Consumer, Vendor])],
  exports: [TypeOrmModule],
})
export class AuthModule {}
