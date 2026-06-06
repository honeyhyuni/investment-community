import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { UserRole } from './user-role.enum';
import { UserStatus } from './user-status.enum';

type CreateUserInput = {
  email: string;
  passwordHash: string;
  nickname: string;
};

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
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

    return this.usersRepository.save(user);
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
    return this.usersRepository.save(user);
  }

  async reject(id: string): Promise<User> {
    const user = await this.findById(id);
    user.status = UserStatus.Rejected;
    user.approvedAt = null;
    return this.usersRepository.save(user);
  }

  async updateNickname(id: string, nickname: string): Promise<User> {
    const user = await this.findById(id);
    user.nickname = nickname.trim();
    return this.usersRepository.save(user);
  }

  async changePassword(
    id: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.findById(id);
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
}
