import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { User, Vendor, Consumer, Admin } from './entities';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { CreateUserDto, LoginUserDto, UserRole, ChangePasswordDto } from './dto';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: jest.Mocked<Repository<User>>;
  let vendorRepository: jest.Mocked<Repository<Vendor>>;
  let consumerRepository: jest.Mocked<Repository<Consumer>>;
  let adminRepository: jest.Mocked<Repository<Admin>>;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            preload: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Vendor),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Consumer),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Admin),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get(getRepositoryToken(User));
    vendorRepository = module.get(getRepositoryToken(Vendor));
    consumerRepository = module.get(getRepositoryToken(Consumer));
    adminRepository = module.get(getRepositoryToken(Admin));
    jwtService = module.get(JwtService);

    // Mock bcrypt
    jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashedPassword' as never);
    jest.spyOn(bcrypt, 'compareSync').mockReturnValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    const mockLoginDto: LoginUserDto = {
      email: 'test@example.com',
      password: 'TestPassword123!',
    };

    const mockUser = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@example.com',
      password: 'hashedPassword',
      name: 'Juan',
      lastname: 'Pérez',
      rol: UserRole.CONSUMER,
    };

    it('should login successfully with valid credentials', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(mockUser as User);
      jwtService.sign.mockReturnValue('mockJwtToken');

      // Act
      const result = await service.login(mockLoginDto);

      // Assert
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: mockLoginDto.email },
        select: { email: true, password: true, id: true, name: true, rol: true },
      });
      expect(bcrypt.compareSync).toHaveBeenCalledWith(mockLoginDto.password, 'hashedPassword');
      expect(jwtService.sign).toHaveBeenCalled();
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('token');
      expect(result.token).toBe('mockJwtToken');
    });

    it('should throw UnauthorizedException if user does not exist', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.login(mockLoginDto)).rejects.toThrow(
        new UnauthorizedException('Credentials are not valid (email)')
      );
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(mockUser as User);
      jest.spyOn(bcrypt, 'compareSync').mockReturnValue(false);

      // Act & Assert
      await expect(service.login(mockLoginDto)).rejects.toThrow(
        new UnauthorizedException('Credentials are not valid (password)')
      );
    });
  });

  describe('create - Consumer', () => {
    const mockCreateConsumerDto = {
      email: 'test@example.com',
      password: 'TestPassword123!',
      name: 'Juan',
      lastname: 'Pérez',
      rol: UserRole.CONSUMER,
      address: 'Calle Falsa 123',
      preferences: { theme: 'dark' },
      searchsHistory: [],
    } as unknown as CreateUserDto;

    const mockConsumer = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@example.com',
      name: 'Juan',
      lastname: 'Pérez',
      rol: UserRole.CONSUMER,
      address: 'Calle Falsa 123',
      preferences: { theme: 'dark' },
      searchsHistory: [],
      dateRegister: new Date(),
    };

    it('should create a consumer successfully', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(null);
      consumerRepository.create.mockReturnValue(mockConsumer as unknown as Consumer);
      consumerRepository.save.mockResolvedValue(mockConsumer as unknown as Consumer);
      jwtService.sign.mockReturnValue('mockJwtToken');

      // Act
      const result = await service.create(mockCreateConsumerDto);

      // Assert
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: mockCreateConsumerDto.email },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(mockCreateConsumerDto.password, 10);
      expect(consumerRepository.create).toHaveBeenCalled();
      expect(consumerRepository.save).toHaveBeenCalled();
      expect(jwtService.sign).toHaveBeenCalled();
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token');
      expect(result.token).toBe('mockJwtToken');
    });

    it('should throw BadRequestException if user already exists', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(mockConsumer as unknown as User);

      // Act & Assert
      await expect(service.create(mockCreateConsumerDto)).rejects.toThrow(
        new BadRequestException(`El usuario con email ${mockCreateConsumerDto.email} ya existe`)
      );
    });
  });

  describe('changePassword', () => {
    const mockChangePasswordDto: ChangePasswordDto = {
      currentPassword: 'currentPassword',
      newPassword: 'newPassword123!',
    };

    const mockUser = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@example.com',
      password: 'hashedCurrentPassword',
      name: 'Juan',
      lastname: 'Pérez',
      rol: UserRole.CONSUMER,
    };

    it('should change password successfully', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(mockUser as User);
      userRepository.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await service.changePassword(mockUser.id, mockChangePasswordDto);

      // Assert
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUser.id },
      });
      expect(bcrypt.compareSync).toHaveBeenCalledWith(
        mockChangePasswordDto.currentPassword,
        mockUser.password
      );
      expect(bcrypt.hash).toHaveBeenCalledWith(mockChangePasswordDto.newPassword, 10);
      expect(userRepository.update).toHaveBeenCalledWith(mockUser.id, {
        password: 'hashedPassword',
      });
      expect(result).toEqual({ message: 'Contraseña cambiada con exito' });
    });

    it('should throw UnauthorizedException if current password is invalid', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(mockUser as User);
      jest.spyOn(bcrypt, 'compareSync').mockReturnValue(false);

      // Act & Assert
      await expect(service.changePassword(mockUser.id, mockChangePasswordDto)).rejects.toThrow(
        new UnauthorizedException('Credentials are not valid (password)')
      );
    });
  });

  describe('checkAuthStatus', () => {
    const mockUser = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@example.com',
      password: 'hashedPassword',
      name: 'Juan',
      lastname: 'Pérez',
      rol: UserRole.CONSUMER,
      dateRegister: new Date(),
    };

    it('should return user data with new token', () => {
      // Arrange
      jwtService.sign.mockReturnValue('newMockJwtToken');

      // Act
      const result = service.checkAuthStatus(mockUser as User);

      // Assert
      expect(jwtService.sign).toHaveBeenCalledWith({
        email: mockUser.email,
        id: mockUser.id,
        rol: mockUser.rol,
      });
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('token');
      expect(result.token).toBe('newMockJwtToken');
      expect(result).not.toHaveProperty('password');
    });
  });

  describe('Error handling', () => {
    it('should handle database errors during user creation', async () => {
      // Arrange
      const mockCreateDto = {
        email: 'test@example.com',
        password: 'TestPassword123!',
        name: 'Juan',
        lastname: 'Pérez',
        rol: UserRole.CONSUMER,
        address: 'Calle Falsa 123',
      } as unknown as CreateUserDto;

      userRepository.findOne.mockResolvedValue(null);
      consumerRepository.create.mockReturnValue({} as Consumer);
      consumerRepository.save.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(service.create(mockCreateDto)).rejects.toThrow('Database error');
    });

    it('should handle JWT service errors', async () => {
      // Arrange
      const mockLoginDto: LoginUserDto = {
        email: 'test@example.com',
        password: 'TestPassword123!',
      };

      const mockUser = {
        id: '123',
        email: 'test@example.com',
        password: 'hashedPassword',
        name: 'Juan',
        lastname: 'Pérez',
        rol: UserRole.CONSUMER,
      };

      userRepository.findOne.mockResolvedValue(mockUser as User);
      jwtService.sign.mockImplementation(() => {
        throw new Error('JWT error');
      });

      // Act & Assert
      await expect(service.login(mockLoginDto)).rejects.toThrow('JWT error');
    });
  });

  describe('Edge cases', () => {
    it('should handle special characters in email', async () => {
      // Arrange
      const specialEmailDto = {
        email: 'test+special@example.com',
        password: 'TestPassword123!',
        name: 'Juan',
        lastname: 'Pérez',
        rol: UserRole.CONSUMER,
        address: 'Calle Falsa 123',
      } as unknown as CreateUserDto;

      const mockConsumer = {
        id: '123',
        email: 'test+special@example.com',
        name: 'Juan',
        lastname: 'Pérez',
        rol: UserRole.CONSUMER,
        address: 'Calle Falsa 123',
        preferences: {},
        searchsHistory: [],
        dateRegister: new Date(),
      };

      userRepository.findOne.mockResolvedValue(null);
      consumerRepository.create.mockReturnValue(mockConsumer as unknown as Consumer);
      consumerRepository.save.mockResolvedValue(mockConsumer as unknown as Consumer);
      jwtService.sign.mockReturnValue('mockJwtToken');

      // Act
      const result = await service.create(specialEmailDto);

      // Assert
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token');
    });
  });
});
