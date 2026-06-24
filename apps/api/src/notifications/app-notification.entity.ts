import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { NotificationType } from './notification-types';

@Entity({ name: 'app_notifications' })
@Index(['userId', 'createdAt'])
@Index(['userId', 'readAt'])
export class AppNotificationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 32 })
  type: NotificationType;

  @Column({ type: 'varchar', length: 240 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'text' })
  url: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  data: Record<string, unknown>;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
