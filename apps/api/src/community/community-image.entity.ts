import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { CommunityPost } from './community-post.entity';

@Entity({ name: 'community_images' })
export class CommunityImage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @ManyToOne(() => CommunityPost, {
    eager: true,
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'post_id' })
  post: CommunityPost | null;

  @Column({ unique: true, length: 80 })
  filename: string;

  @Column({ name: 'mime_type', length: 40 })
  mimeType: string;

  @Column({ type: 'integer' })
  width: number;

  @Column({ type: 'integer' })
  height: number;

  @Column({ type: 'integer' })
  size: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

