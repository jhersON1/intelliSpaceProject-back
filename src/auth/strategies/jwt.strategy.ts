import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { User } from '../entities/user.entity';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
  ) {
    super({
      secretOrKey: configService.get<string>('JWT_SECRET') || 'SARAMAMBICHE123',
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
    });
  }
  async validate(payload: JwtPayload): Promise<User> {
    const { id } = payload;

    if (!id) {
      throw new UnauthorizedException('Token payload is invalid');
    }

    const user = await this.userRepository.findOne({ 
      where: { id },
      select: ['id', 'email', 'name', 'lastname', 'rol']
    });

    if (!user) {
      throw new UnauthorizedException('Token not valid');
    }

    if (!user.id) {
      throw new UnauthorizedException('User data is incomplete');
    }

    return user;
  }
}
