import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Consumer, User, Vendor } from './entities';
import * as bcrypt from 'bcrypt';
import {
  ChangePasswordDto,
  CreateUserDto,
  LoginUserDto,
  UserRole,
} from './dto';
import { JwtPayload } from './interfaces';
import { JwtService } from '@nestjs/jwt';
import { UpdateUserDto } from './dto/update-user.dto';
import { ConnectionCloudinaryService } from '../connection-cloudinary/connection-cloudinary.service';

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
    private readonly connectionCloudinaryService: ConnectionCloudinaryService,
  ) {}

  async create(createUserDto: CreateUserDto, file?: Express.Multer.File) {
    const { email, password, rol } = createUserDto;

    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new BadRequestException(`El usuario con email ${email} ya existe`);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear el usuario según el rol pero sin la imagen primero
    try {
      if (rol === UserRole.CONSUMER) {
        const consumer = await this.createConsumer(
          createUserDto,
          hashedPassword,
        );

        // Una vez creado exitosamente, procesamos la imagen si existe
        if (file) {
          const image = await this.connectionCloudinaryService.uploadImage(
            file,
          );
          await this.consumerRepository.update(consumer.id, { avatar: image });
          consumer.avatar = image; // Actualizamos el objeto en memoria también
        }

        return {
          user: this.parseUser(consumer),
          token: this.getJwtToken({
            email: consumer.email,
            id: consumer.id,
            rol: consumer.rol,
          }),
        };
      }

      if (rol === UserRole.VENDOR) {
        const vendor = await this.createVendor(createUserDto, hashedPassword);

        // Una vez creado exitosamente, procesamos la imagen si existe
        if (file) {
          const image = await this.connectionCloudinaryService.uploadImage(
            file,
          );
          await this.vendorRepository.update(vendor.id, { logo: image });
          vendor.logo = image; // Actualizamos el objeto en memoria también
        }

        return {
          user: this.parseUser(vendor),
          token: this.getJwtToken({
            email: vendor.email,
            id: vendor.id,
            rol: vendor.rol,
          }),
        };
      }

      throw new BadRequestException(`Rol ${rol} no válido`);
    } catch (error) {
      // Si ocurre algún error durante la creación del usuario, no se habrá subido ninguna imagen
      // y podemos simplemente propagar el error
      throw error;
    }
  }

  async login(loginUserDto: LoginUserDto) {
    const { password, email } = loginUserDto;

    const user = await this.userRepository.findOne({
      where: { email },
      select: { email: true, password: true, id: true, name: true, rol: true },
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
      name: user.name,
      token: this.getJwtToken({
        email: user.email,
        id: user.id,
        rol: user.rol,
      }),
    };
  }

  async changePassword(id: string, changePasswordDto: ChangePasswordDto) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { currentPassword, newPassword } = changePasswordDto;

    if (!bcrypt.compareSync(currentPassword, user.password)) {
      throw new UnauthorizedException('Credentials are not valid (password)');
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.userRepository.update(id, { password: hashedPassword });
    return { message: 'Contraseña cambiada con exito' };
  }

  checkAuthStatus(user: User) {
    return {
      ...this.parseUser(user),
      token: this.getJwtToken({
        email: user.email,
        id: user.id,
        rol: user.rol,
      }),
    };
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    file?: Express.Multer.File,
  ) {
    const userUpdate = await this.userRepository.preload({
      id,
      ...updateUserDto,
    });

    if (!userUpdate) {
      throw new NotFoundException(`Usuario con ID: ${id} no encontrado`);
    }
    const savedUser = await this.userRepository.save(userUpdate);

    return savedUser;
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
      nameBusiness: createVendorDto.nameBusiness?.trim(),
      password: password,
      verificationDocuments: createVendorDto.verificationDocuments,
    });

    return await this.vendorRepository.save(vendor);
  }

  private async validateDataVendor(createVendorDto: CreateUserDto) {
    const { nameBusiness } = createVendorDto;

    const nombreNegocioTrim = nameBusiness.trim();

    const existinNegocio = await this.vendorRepository.findOne({
      where: { nameBusiness: nombreNegocioTrim },
    });

    if (existinNegocio) {
      throw new BadRequestException(
        `La Empresa o Negocio con nombre: ${nombreNegocioTrim} ya existe`,
      );
    }
    return true;
  }

  private async createConsumer(
    createConsumerDto: CreateUserDto,
    password: string,
  ) {
    const { address, preferences, searchsHistory = [] } = createConsumerDto;

    const consumer = this.consumerRepository.create({
      ...createConsumerDto,
      password: password,
      searchsHistory,
      preferences: preferences || {},
    });
    return await this.consumerRepository.save(consumer);
  }
}
