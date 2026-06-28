import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { CommunityController } from './community.controller';
import { CommunityPost } from './community-post.entity';
import { CommunityService } from './community.service';
import { CommunityNotificationJobsService } from './community-notification-jobs.service';
import { PostComment } from './post-comment.entity';
import { PostLike } from './post-like.entity';
import { UserSubscription } from './user-subscription.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      CommunityPost,
      PostLike,
      PostComment,
      UserSubscription,
    ]),
  ],
  controllers: [CommunityController],
  providers: [CommunityService, CommunityNotificationJobsService],
})
export class CommunityModule {}
