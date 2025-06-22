import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Request,
  ParseUUIDPipe
} from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { CreateMessageDto, UpdateMessageDto } from './dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { ValidRoles } from '../auth/interfaces/valid-roles.interface';

@Controller('messaging')
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}
  /**
   * Crear un nuevo mensaje (solo para consumers)
   */
  @Post()
  @Auth(ValidRoles.CONSUMER)
  async createMessage(@Request() req, @Body() createMessageDto: CreateMessageDto) {
    const userId = req.user.id;
    return await this.messagingService.createMessage(userId, createMessageDto);
  }
  /**
   * Obtener mensajes recibidos (para vendors)
   */
  @Get('received')
  @Auth(ValidRoles.VENDOR)
  async getReceivedMessages(@Request() req) {
    const userId = req.user.id;
    return await this.messagingService.getMessagesForVendor(userId);
  }
  /**
   * Obtener mensajes enviados (para consumers)
   */
  @Get('sent')
  @Auth(ValidRoles.CONSUMER)
  async getSentMessages(@Request() req) {
    const userId = req.user.id;
    return await this.messagingService.getMessagesFromConsumer(userId);
  }
  /**
   * Obtener número de mensajes no leídos (para vendors)
   */
  @Get('unread-count')
  @Auth(ValidRoles.VENDOR)
  async getUnreadCount(@Request() req) {
    const userId = req.user.id;
    return { count: await this.messagingService.getUnreadCount(userId) };
  }
  /**
   * Marcar mensaje como leído (para vendors)
   */
  @Patch(':id/read')
  @Auth(ValidRoles.VENDOR)
  async markAsRead(@Param('id', ParseUUIDPipe) messageId: string, @Request() req) {
    const userId = req.user.id;
    return await this.messagingService.markAsRead(messageId, userId);
  }

  /**
   * Obtener un mensaje específico
   */
  @Get(':id')
  @Auth(ValidRoles.CONSUMER, ValidRoles.VENDOR)
  async getMessage(@Param('id', ParseUUIDPipe) messageId: string, @Request() req) {
    const userId = req.user.id;
    return await this.messagingService.getMessageById(messageId, userId);
  }
}
