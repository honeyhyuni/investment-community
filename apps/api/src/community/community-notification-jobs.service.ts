import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { PostLike } from './post-like.entity';

@Injectable()
export class CommunityNotificationJobsService {
  private readonly logger = new Logger(CommunityNotificationJobsService.name);

  constructor(
    @InjectRepository(PostLike)
    private readonly likes: Repository<PostLike>,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron('0 */15 * * * *', { timeZone: 'Asia/Seoul' })
  async sendLikeDigests(): Promise<void> {
    const bucketEnd = new Date();
    bucketEnd.setSeconds(0, 0);
    bucketEnd.setMinutes(Math.floor(bucketEnd.getMinutes() / 15) * 15);
    const bucketStart = new Date(bucketEnd.getTime() - 15 * 60_000);
    const likes = await this.likes.find({
      where: { createdAt: MoreThanOrEqual(bucketStart) },
      relations: { post: { author: true }, user: true },
      order: { createdAt: 'ASC' },
    });

    const byPost = new Map<string, PostLike[]>();
    for (const like of likes) {
      if (like.user.id === like.post.author.id) continue;
      const group = byPost.get(like.post.id) ?? [];
      group.push(like);
      byPost.set(like.post.id, group);
    }

    await Promise.allSettled(
      [...byPost.values()].map(async (group) => {
        const first = group[0];
        const names = [...new Set(group.map((like) => like.user.nickname))];
        const actor =
          names.length === 1
            ? names[0]
            : `${names[0]} 외 ${names.length - 1}명`;
        await this.notifications.sendToUser(
          first.post.author.id,
          {
            type: 'LIKE',
            title: '새 좋아요',
            body: `${actor}이(가) 회원님의 게시글을 좋아합니다.`,
            url: `/community/${first.post.id}`,
            data: { postId: first.post.id, count: group.length },
            tag: `likes:${first.post.id}`,
          },
          `likes:${first.post.id}:${bucketStart.toISOString()}`,
        );
      }),
    ).catch((error) => {
      this.logger.warn(
        `Like digest failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    });
  }
}
