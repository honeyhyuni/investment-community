import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity({ name: 'community_posts' })
export class CommunityPost {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  author: User;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 160, nullable: true })
  title: string | null;

  @Column({ name: 'content_blocks', type: 'simple-json', nullable: true })
  contentBlocks:
    | Array<{
        id: string;
        type: 'text' | 'image';
        text?: string;
        url?: string;
      }>
    | null;

  @Column({ name: 'image_urls', type: 'simple-json', default: '[]' })
  imageUrls: string[];

  @Column({ type: 'text', default: '' })
  caption: string;

  @Column({ name: 'stock_tags', type: 'simple-json', default: '[]' })
  stockTags: Array<{
    symbol: string;
    name: string;
    market: 'US' | 'KR';
  }>;

  @Column({ name: 'is_public', type: 'boolean', default: true })
  isPublic: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
