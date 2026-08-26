import { ForbiddenException } from '@nestjs/common';
import { User } from '../users/user.entity';

export const DEMO_READONLY_EMAIL = 'test@test.com';

export function assertNotDemoReadonlyUser(user: Pick<User, 'email'>): void {
  if (user.email.toLowerCase() === DEMO_READONLY_EMAIL) {
    throw new ForbiddenException('Demo account is read-only in community feed.');
  }
}
