import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Consumer, User, Vendor } from './entities';
import * as bcrypt from 'bcrypt';
import { CreateUserDto, UserRole } from './dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Vendor)
    private readonly vendorRepository: Repository<Vendor>,
    @InjectRepository(Consumer)
    private readonly consumerRepository: Repository<Consumer>,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const { email, password, rol } = createUserDto;

    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new BadRequestException(`El usuario con email ${email} ya existe`);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear el usuario según el rol
    if (rol === UserRole.CONSUMER) {
      const consumer = await this.createConsumer(createUserDto, hashedPassword);
      return this.parseUser(consumer);
    }

    if (rol === UserRole.VENDOR) {
      const vendor = await this.createVendor(createUserDto, hashedPassword);
      return this.parseUser(vendor);
    }

    throw new BadRequestException(`Rol ${rol} no válido`);
  }

  private parseUser(user: User) {
    const { password: _, ...userWithoutPassword } = user;

    return { ...userWithoutPassword };
  }

  private async createVendor(createVendorDto: CreateUserDto, password: string) {
    await this.validateDataVendor(createVendorDto);

    const vendor = this.vendorRepository.create({
      ...createVendorDto,
      nombreNegocio: createVendorDto.nombreNegocio?.trim(),
      password: password,
      documentosVerificacion: createVendorDto.documentosVerificacion,
    });

    return await this.vendorRepository.save(vendor);
  }

  private async validateDataVendor(createVendorDto: CreateUserDto) {
    const { nombreNegocio } = createVendorDto;

    const existinNegocio = await this.vendorRepository.findOne({
      where: { nombreNegocio },
    });

    if (existinNegocio) {
      throw new BadRequestException(
        `La Empresa o Negocio con nombre: ${nombreNegocio} ya existe`,
      );
    }
    return true;
  }

  private async createConsumer(
    createConsumerDto: CreateUserDto,
    password: string,
  ) {
    const {
      direccion,
      preferencias,
      historialBusquedas = [],
    } = createConsumerDto;

    const consumer = this.consumerRepository.create({
      ...createConsumerDto,
      password: password,
      historialBusquedas,
      preferencias: preferencias || {},
    });
    return await this.consumerRepository.save(consumer);
  }
}
