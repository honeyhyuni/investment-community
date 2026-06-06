import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { IsEnum } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from './user-role.enum';
import { UserResponseDto } from './user-response.dto';
import { UserStatus } from './user-status.enum';
import { UsersService } from './users.service';

class UpdateUserStatusDto {
  @IsEnum(UserStatus)
  status: UserStatus;
}

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Admin)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('pending')
  async getPendingUsers(): Promise<UserResponseDto[]> {
    const users = await this.usersService.findPending();
    return users.map(UserResponseDto.from);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: UpdateUserStatusDto,
  ): Promise<UserResponseDto> {
    const user =
      body.status === UserStatus.Approved
        ? await this.usersService.approve(id)
        : await this.usersService.reject(id);

    return UserResponseDto.from(user);
  }
}
