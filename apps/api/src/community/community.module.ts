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
import { CommunityImage } from './community-image.entity';
import { CommunityImagesService } from './community-images.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      CommunityPost,
      PostLike,
      PostComment,
      UserSubscription,
      CommunityImage,
    ]),
  ],
  controllers: [CommunityController],
  providers: [CommunityService, CommunityImagesService, CommunityNotificationJobsService],
})
export class CommunityModule {}
