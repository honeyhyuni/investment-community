import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from './user.entity';
import { UserRole } from './user-role.enum';
import { UserStatus } from './user-status.enum';

type CreateUserInput = {
  email: string;
  passwordHash: string;
  nickname: string;
};

const DEMO_READONLY_EMAIL = 'test@test.com';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(input: CreateUserInput): Promise<User> {
    const email = input.email.toLowerCase().trim();
    const exists = await this.usersRepository.exists({ where: { email } });

    if (exists) {
      throw new ConflictException('Email is already registered.');
    }

    const userCount = await this.usersRepository.count();
    const isFirstUser = userCount === 0;

    const user = this.usersRepository.create({
      email,
      passwordHash: input.passwordHash,
      nickname: input.nickname.trim(),
      role: isFirstUser ? UserRole.Admin : UserRole.User,
      status: isFirstUser ? UserStatus.Approved : UserStatus.Pending,
      approvedAt: isFirstUser ? new Date() : null,
    });

    const savedUser = await this.usersRepository.save(user);
    if (!isFirstUser) {
      const admins = await this.usersRepository.find({
        where: { role: UserRole.Admin, status: UserStatus.Approved },
      });
      await this.notificationsService
        .sendSystemToUsers(
          admins.map((admin) => admin.id),
          {
            type: 'ACCOUNT',
            title: '\uAC00\uC785 \uC2B9\uC778 \uC694\uCCAD',
            body: `${savedUser.nickname} (${savedUser.email})\uB2D8\uC774 \uAC00\uC785\uC744 \uC694\uCCAD\uD588\uC2B5\uB2C8\uB2E4.`,
            url: '/admin',
            data: { userId: savedUser.id },
            tag: `signup-request-${savedUser.id}`,
          },
          (adminId) => `signup-request:${savedUser.id}:${adminId}`,
        )
        .catch((error: unknown) => {
          this.logger.warn(
            `Could not send signup request notification: ${
              error instanceof Error ? error.message : 'unknown error'
            }`,
          );
        });
    }
    return savedUser;
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email: email.toLowerCase().trim() },
    });
  }

  async findById(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return user;
  }

  findPending(): Promise<User[]> {
    return this.usersRepository.find({
      where: { status: UserStatus.Pending },
      order: { createdAt: 'ASC' },
    });
  }

  async approve(id: string): Promise<User> {
    const user = await this.findById(id);
    user.status = UserStatus.Approved;
    user.approvedAt = new Date();
    const savedUser = await this.usersRepository.save(user);
    await this.notificationsService
      .sendSystemToUser(
        savedUser.id,
        {
          type: 'ACCOUNT',
          title: '\uAC00\uC785 \uC2B9\uC778 \uC644\uB8CC',
          body: '\uAC00\uC785 \uC2B9\uC778\uC774 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uC774\uC81C 15F\uC5D0 \uB85C\uADF8\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.',
          url: '/',
          data: { userId: savedUser.id },
          tag: `signup-approved-${savedUser.id}`,
        },
        `signup-approved:${savedUser.id}`,
      )
      .catch((error: unknown) => {
        this.logger.warn(
          `Could not send approval notification: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      });
    return savedUser;
  }

  async reject(id: string): Promise<User> {
    const user = await this.findById(id);
    user.status = UserStatus.Rejected;
    user.approvedAt = null;
    return this.usersRepository.save(user);
  }

  async updateNickname(id: string, nickname: string): Promise<User> {
    const user = await this.findById(id);
    this.assertMutableUser(user);
    user.nickname = nickname.trim();
    return this.usersRepository.save(user);
  }

  async changePassword(
    id: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.findById(id);
    this.assertMutableUser(user);
    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Current password is incorrect.');
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.refreshTokenHash = null;
    await this.usersRepository.save(user);
  }

  async updateRefreshTokenHash(
    id: string,
    refreshTokenHash: string | null,
  ): Promise<void> {
    await this.usersRepository.update(id, { refreshTokenHash });
  }

  private assertMutableUser(user: Pick<User, 'email'>): void {
    if (user.email.toLowerCase() === DEMO_READONLY_EMAIL) {
      throw new ForbiddenException('Demo account profile is read-only.');
    }
  }
}
