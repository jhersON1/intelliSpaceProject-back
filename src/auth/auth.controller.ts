import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Put,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto, LoginUserDto, UpdateUserDto } from './dto';
import { Auth, GetUser } from './decorators';
import { User } from './entities';
import { ChangePasswordDto } from './dto/change-password.dto';
import { SystemLoggerService } from '../common/services/system-logger.service';
import { LogLevel } from '../common/entities/system-log.entity';
import { Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly systemLogger: SystemLoggerService,
  ) {}
  @Post('register')
  async create(@Body() createUserDto: CreateUserDto, @Req() req: Request) {
    try {
      const result = await this.authService.create(createUserDto);
      
      // Log successful registration
      await this.systemLogger.logWithBusinessContext(
        LogLevel.WARN, // Using WARN for successful registration to track user activity
        `New user registered: ${createUserDto.email}`,
        'User Registration',
        req as any,
        { userEmail: createUserDto.email, userRole: createUserDto.rol }
      );
      
      return result;
    } catch (error) {
      // Error will be logged by the interceptor, but we can add business context
      await this.systemLogger.logWithBusinessContext(
        LogLevel.ERROR,
        `Failed user registration attempt: ${error.message}`,
        'User Registration Failed',
        req as any,
        { userEmail: createUserDto.email, userRole: createUserDto.rol },
        { registrationData: createUserDto }
      );
      throw error;
    }
  }
  @Post('login')
  async loginUser(@Body() loginUserDto: LoginUserDto, @Req() req: Request) {
    try {
      const result = await this.authService.login(loginUserDto);
      
      // Log successful login
      await this.systemLogger.logWithBusinessContext(
        LogLevel.WARN, // Using WARN to track login activity
        `User login successful: ${loginUserDto.email}`,
        'User Login',
        req as any,
        { userEmail: loginUserDto.email }
      );
      
      return result;
    } catch (error) {
      // Error will be logged by the interceptor, but we can add business context
      await this.systemLogger.logWithBusinessContext(
        LogLevel.ERROR,
        `Failed login attempt: ${error.message}`,
        'User Login Failed',
        req as any,
        { userEmail: loginUserDto.email },
        { loginAttempt: { email: loginUserDto.email } }
      );
      throw error;
    }
  }

  @Get('check-status')
  @Auth()
  checkAuthStatus(@GetUser() user: User) {
    return this.authService.checkAuthStatus(user);
  }

  @Patch('update-user')
  @Auth()
  update(@GetUser() user: User, @Body() updateUserDto: UpdateUserDto) {
    return this.authService.update(user.id, updateUserDto);
  }

  @Put('change-password')
  @Auth()
  changePassword(
    @GetUser() user: User,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.id, changePasswordDto);
  }
}
