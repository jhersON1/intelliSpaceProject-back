import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './entities/message.entity';
import { CreateMessageDto, UpdateMessageDto } from './dto';
import { Consumer } from '../auth/entities/consumer.entity';
import { Vendor } from '../auth/entities/vendor.entity';
import { Product } from '../products/entities/product.entity';

@Injectable()
export class MessagingService {
  constructor(
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    @InjectRepository(Consumer)
    private consumerRepository: Repository<Consumer>,
    @InjectRepository(Vendor)
    private vendorRepository: Repository<Vendor>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
  ) {}

  /**
   * Crear un nuevo mensaje de un consumer a un vendor sobre un producto
   */
  async createMessage(consumerId: string, createMessageDto: CreateMessageDto): Promise<Message> {
    const { productId, vendorId, subject, content } = createMessageDto;

    // Verificar que el consumer existe
    const consumer = await this.consumerRepository.findOne({ where: { id: consumerId } });
    if (!consumer) {
      throw new NotFoundException('Consumer no encontrado');
    }

    // Verificar que el vendor existe
    const vendor = await this.vendorRepository.findOne({ where: { id: vendorId } });
    if (!vendor) {
      throw new NotFoundException('Vendor no encontrado');
    }

    // Verificar que el producto existe y pertenece al vendor
    const product = await this.productRepository.findOne({ 
      where: { id: productId },
      relations: ['vendor']
    });
    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    if (product.vendor.id !== vendorId) {
      throw new BadRequestException('El producto no pertenece al vendor especificado');
    }

    // Crear el mensaje
    const message = this.messageRepository.create({
      subject,
      content,
      consumerId,
      vendorId,
      productId,
      isRead: false
    });

    return await this.messageRepository.save(message);
  }

  /**
   * Obtener todos los mensajes recibidos por un vendor
   */
  async getMessagesForVendor(vendorId: string): Promise<Message[]> {
    const vendor = await this.vendorRepository.findOne({ where: { id: vendorId } });
    if (!vendor) {
      throw new NotFoundException('Vendor no encontrado');
    }

    return await this.messageRepository.find({
      where: { vendorId },
      relations: ['consumer', 'product'],
      order: { createdAt: 'DESC' }
    });
  }

  /**
   * Obtener todos los mensajes enviados por un consumer
   */
  async getMessagesFromConsumer(consumerId: string): Promise<Message[]> {
    const consumer = await this.consumerRepository.findOne({ where: { id: consumerId } });
    if (!consumer) {
      throw new NotFoundException('Consumer no encontrado');
    }

    return await this.messageRepository.find({
      where: { consumerId },
      relations: ['vendor', 'product'],
      order: { createdAt: 'DESC' }
    });
  }

  /**
   * Marcar un mensaje como leído
   */
  async markAsRead(messageId: string, vendorId: string): Promise<Message> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId, vendorId },
      relations: ['consumer', 'product']
    });

    if (!message) {
      throw new NotFoundException('Mensaje no encontrado');
    }

    message.isRead = true;
    return await this.messageRepository.save(message);
  }

  /**
   * Obtener el número de mensajes no leídos para un vendor
   */
  async getUnreadCount(vendorId: string): Promise<number> {
    return await this.messageRepository.count({
      where: { vendorId, isRead: false }
    });
  }

  /**
   * Obtener un mensaje específico
   */
  async getMessageById(messageId: string, userId: string): Promise<Message> {
    const message = await this.messageRepository.findOne({
      where: [
        { id: messageId, vendorId: userId },
        { id: messageId, consumerId: userId }
      ],
      relations: ['consumer', 'vendor', 'product']
    });

    if (!message) {
      throw new NotFoundException('Mensaje no encontrado');
    }

    return message;
  }
}
