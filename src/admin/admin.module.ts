import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { CommonModule } from '../common/common.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  controllers: [AdminController],
  providers: [AdminService],
  imports: [CommonModule, AuthModule],
})
export class AdminModule {}
