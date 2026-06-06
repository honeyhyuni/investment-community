import {
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity({ name: 'community_user_subscriptions' })
@Unique(['subscriber', 'creator'])
export class UserSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  subscriber: User;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  creator: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
