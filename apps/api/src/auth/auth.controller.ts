import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import type { CookieOptions, Request, Response } from 'express';
import { UsersService } from '../users/users.service';
import { UserResponseDto } from '../users/user-response.dto';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginDto } from './login.dto';
import { RegisterDto } from './register.dto';
import type { AuthUser } from './auth-user.type';

const REFRESH_TOKEN_COOKIE = 'refresh_token';

class UpdateProfileDto {
  @IsString()
  @MinLength(2)
  @MaxLength(24)
  nickname: string;
}

class ChangePasswordDto {
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  currentPassword: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);
    this.setRefreshTokenCookie(res, result.refreshToken);

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] as
      | string
      | undefined;

    if (!refreshToken) {
      throw new UnauthorizedException();
    }

    const result = await this.authService.refresh(refreshToken);
    this.setRefreshTokenCookie(res, result.refreshToken);

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(
    @CurrentUser() currentUser: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(currentUser.sub);
    res.clearCookie(REFRESH_TOKEN_COOKIE, this.getRefreshCookieOptions());
    res.clearCookie(REFRESH_TOKEN_COOKIE, {
      ...this.getRefreshCookieOptions(),
      path: '/api/auth',
    });

    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() currentUser: AuthUser): Promise<UserResponseDto> {
    const user = await this.usersService.findById(currentUser.sub);
    return UserResponseDto.from(user);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateMe(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    const user = await this.usersService.updateNickname(
      currentUser.sub,
      body.nickname,
    );
    return UserResponseDto.from(user);
  }

  @Patch('password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: ChangePasswordDto,
  ): Promise<{ ok: true }> {
    await this.usersService.changePassword(
      currentUser.sub,
      body.currentPassword,
      body.newPassword,
    );
    return { ok: true };
  }

  private setRefreshTokenCookie(res: Response, refreshToken: string): void {
    res.cookie(
      REFRESH_TOKEN_COOKIE,
      refreshToken,
      this.getRefreshCookieOptions(),
    );
  }

  private getRefreshCookieOptions(): CookieOptions {
    const isProduction = process.env.NODE_ENV === 'production';

    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    };
  }
}
