import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AdminService, LogFilters } from './admin.service';
import { Auth } from '../auth/decorators';
import { ValidRoles } from '../auth/interfaces';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { User } from '../auth/entities';
import { LogLevel } from '../common/entities/system-log.entity';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}
  /**
   * Obtener logs del sistema (solo para ADMIN)
   */
  @Get('logs')
  @Auth(ValidRoles.ADMIN)
  async getLogs(
    @Query('level') level?: LogLevel,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
    @Query('resolved') resolved?: string,
    @Query('search') search?: string,
  ) {
    const filters: LogFilters = {
      level,
      startDate,
      endDate,
      limit: limit ? parseInt(limit) : 20,
      page: page ? parseInt(page) : 1,
      resolved: resolved !== undefined ? resolved === 'true' : undefined,
      search,
    };

    return await this.adminService.getLogs(filters);
  }
  /**
   * Obtener estadísticas de logs (solo para ADMIN)
   */
  @Get('logs/stats')
  @Auth(ValidRoles.ADMIN)
  async getLogsStats() {
    return await this.adminService.getDashboardStats();
  }

  /**
   * Marcar un log como resuelto (solo para ADMIN)
   */
  @Patch('logs/:id/resolve')
  @Auth(ValidRoles.ADMIN)
  async resolveLog(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() admin: User,
  ) {
    return await this.adminService.resolveLog(id, admin.email);
  }
}
