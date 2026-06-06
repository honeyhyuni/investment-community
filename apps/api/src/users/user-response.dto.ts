import { User } from './user.entity';
import { UserRole } from './user-role.enum';
import { UserStatus } from './user-status.enum';

export class UserResponseDto {
  id: string;
  email: string;
  nickname: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  approvedAt: Date | null;

  static from(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      approvedAt: user.approvedAt,
    };
  }
}
