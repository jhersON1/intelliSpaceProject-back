import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Consumer, User, Vendor } from './entities';
import * as bcrypt from 'bcrypt';
import { CreateUserDto, LoginUserDto, UserRole } from './dto';
import { JwtPayload } from './interfaces';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Vendor)
    private readonly vendorRepository: Repository<Vendor>,
    @InjectRepository(Consumer)
    private readonly consumerRepository: Repository<Consumer>,
    private readonly jwtService: JwtService,
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
      return {
        user: this.parseUser(consumer),
        token: this.getJwtToken({ email: consumer.email, id: consumer.id }),
      };
    }

    if (rol === UserRole.VENDOR) {
      const vendor = await this.createVendor(createUserDto, hashedPassword);
      return {
        user: this.parseUser(vendor),
        token: this.getJwtToken({ email: vendor.email, id: vendor.id }),
      };
    }

    throw new BadRequestException(`Rol ${rol} no válido`);
  }

  async login(loginUserDto: LoginUserDto) {
    const { password, email } = loginUserDto;

    const user = await this.userRepository.findOne({
      where: { email },
      select: { email: true, password: true, id: true, nombre: true },
    });

    if (!user) {
      throw new UnauthorizedException('Credentials are not valid (email)');
    }

    if (!bcrypt.compareSync(password, user.password)) {
      throw new UnauthorizedException('Credentials are not valid (password)');
    }

    return {
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      token: this.getJwtToken({ email: user.email, id: user.id }),
    };
  }

  checkAuthStatus(user: User) {
    return {
      ...this.parseUser(user),
      token: this.getJwtToken({ email: user.email, id: user.id }),
    };
  }

  private getJwtToken(payload: JwtPayload) {
    const token = this.jwtService.sign(payload);
    return token;
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
