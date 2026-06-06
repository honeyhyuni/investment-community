import { UserRole } from '../users/user-role.enum';
import { UserStatus } from '../users/user-status.enum';

export type AuthUser = {
  sub: string;
  email: string;
  role: UserRole;
  status: UserStatus;
};
