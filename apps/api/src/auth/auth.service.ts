import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { UserResponseDto } from '../users/user-response.dto';
import { UserStatus } from '../users/user-status.enum';
import { LoginDto } from './login.dto';
import { RegisterDto } from './register.dto';
import { AuthUser } from './auth-user.type';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
      nickname: dto.nickname,
    });

    return {
      user: UserResponseDto.from(user),
      message:
        user.status === UserStatus.Approved
          ? 'Account is approved.'
          : 'Account is pending admin approval.',
    };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (user.status !== UserStatus.Approved) {
      throw new ForbiddenException('Account is not approved.');
    }

    const accessToken = await this.signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    });
    const refreshToken = await this.signRefreshToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    });
    const refreshTokenHash = await bcrypt.hash(refreshToken, 12);
    await this.usersService.updateRefreshTokenHash(user.id, refreshTokenHash);

    return {
      accessToken,
      refreshToken,
      user: UserResponseDto.from(user),
    };
  }

  async refresh(refreshToken: string) {
    const payload = await this.verifyRefreshToken(refreshToken);
    const user = await this.usersService.findById(payload.sub);

    if (
      user.status !== UserStatus.Approved ||
      !user.refreshTokenHash ||
      !(await bcrypt.compare(refreshToken, user.refreshTokenHash))
    ) {
      throw new UnauthorizedException();
    }

    const accessToken = await this.signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    });
    const nextRefreshToken = await this.signRefreshToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    });
    const refreshTokenHash = await bcrypt.hash(nextRefreshToken, 12);
    await this.usersService.updateRefreshTokenHash(user.id, refreshTokenHash);

    return {
      accessToken,
      refreshToken: nextRefreshToken,
      user: UserResponseDto.from(user),
    };
  }

  async logout(userId: string): Promise<void> {
    await this.usersService.updateRefreshTokenHash(userId, null);
  }

  private signAccessToken(payload: AuthUser): Promise<string> {
    return this.jwtService.signAsync(payload);
  }

  private signRefreshToken(payload: AuthUser): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: '30d',
    });
  }

  private verifyRefreshToken(refreshToken: string): Promise<AuthUser> {
    return this.jwtService.verifyAsync<AuthUser>(refreshToken, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
    });
  }
}
