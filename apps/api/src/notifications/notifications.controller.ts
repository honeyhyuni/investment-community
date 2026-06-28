import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import type { AuthUser } from '../auth/auth-user.type';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { NotificationPreferences } from './notification-types';
import { NotificationsService } from './notifications.service';

class PushKeysDto {
  @IsString() p256dh: string;
  @IsString() auth: string;
}

class PushSubscriptionDto {
  @IsString() endpoint: string;
  @ValidateNested()
  @Type(() => PushKeysDto)
  keys: PushKeysDto;
}

class UnsubscribeDto {
  @IsString() endpoint: string;
}

class PreferencesDto implements Partial<NotificationPreferences> {
  @IsOptional() @IsBoolean() priceEnabled?: boolean;
  @IsOptional() @IsBoolean() earningsEnabled?: boolean;
  @IsOptional() @IsBoolean() ipoEnabled?: boolean;
  @IsOptional() @IsBoolean() communityEnabled?: boolean;
  @IsOptional() @IsBoolean() newPostEnabled?: boolean;
  @IsOptional() @IsBoolean() marketBriefingEnabled?: boolean;
}

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get('vapid-public-key')
  getPublicConfig() {
    return this.service.getPublicConfig();
  }

  @Post('test')
  @UseGuards(JwtAuthGuard)
  sendTest(@CurrentUser() user: AuthUser) {
    return this.service.sendTest(user.sub);
  }

  @Post('subscriptions')
  @UseGuards(JwtAuthGuard)
  subscribe(
    @CurrentUser() user: AuthUser,
    @Body() body: PushSubscriptionDto,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.service.subscribe(user.sub, { ...body, userAgent });
  }

  @Delete('subscriptions')
  @UseGuards(JwtAuthGuard)
  unsubscribe(@CurrentUser() user: AuthUser, @Body() body: UnsubscribeDto) {
    return this.service.unsubscribe(user.sub, body.endpoint);
  }

  @Get('preferences')
  @UseGuards(JwtAuthGuard)
  getPreferences(@CurrentUser() user: AuthUser) {
    return this.service.getPreferences(user.sub);
  }

  @Patch('preferences')
  @UseGuards(JwtAuthGuard)
  updatePreferences(
    @CurrentUser() user: AuthUser,
    @Body() body: PreferencesDto,
  ) {
    return this.service.updatePreferences(user.sub, body);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  list(@CurrentUser() user: AuthUser, @Query('limit') limit?: string) {
    return this.service.list(user.sub, limit ? Number(limit) : 30);
  }

  @Patch('read-all')
  @UseGuards(JwtAuthGuard)
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.service.markRead(user.sub);
  }

  @Patch(':id/read')
  @UseGuards(JwtAuthGuard)
  markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.markRead(user.sub, id);
  }
}
