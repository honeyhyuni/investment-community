import { CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { User } from '../users/user.entity';
import { CommunityPost } from './community-post.entity';

@Entity({ name: 'community_post_bookmarks' })
@Unique(['post', 'user'])
export class PostBookmark {
  @PrimaryGeneratedColumn('uuid') id: string;
  @ManyToOne(() => CommunityPost, { onDelete: 'CASCADE' }) post: CommunityPost;
  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' }) user: User;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}