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
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto, LoginUserDto, UpdateUserDto } from './dto';
import { Auth, GetUser } from './decorators';
import { User } from './entities';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  create(@Body() createUserDto: CreateUserDto) {
    return this.authService.create(createUserDto);
  }

  @Post('login')
  loginUser(@Body() loginUserDto: LoginUserDto) {
    return this.authService.login(loginUserDto);
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

  @Get('hora')
  printHora() {
    // Obtener la fecha actual
    const fechaActual = new Date();

    // Ajustar la fecha a UTC-04:00 (compensar 4 horas)
    // PostgreSQL almacena timestamps en UTC, por lo que debemos ajustar el offset
    const offsetHours = 4; // UTC-04:00
    const utcDate = new Date(
      fechaActual.getTime() + offsetHours * 60 * 60 * 1000,
    );

    // Formatear en formato ISO 8601 para PostgreSQL: YYYY-MM-DD HH:MM:SS.sss±TZ
    // PostgreSQL acepta timestamps en formato ISO 8601
    const timestamp = utcDate.toISOString();

    console.log(`Timestamp para PostgreSQL (UTC-04:00): ${timestamp}`);

    // Alternativa: si prefieres devolver específicamente el formato YYYY-MM-DD HH:MM:SS
    // const formattedTimestamp = timestamp.replace('T', ' ').substring(0, 19);

    return timestamp;
  }
}
