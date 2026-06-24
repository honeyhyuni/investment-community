import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { UserStatus } from '../users/user-status.enum';
import { UserRole } from '../users/user-role.enum';
import { CommunityPost } from './community-post.entity';
import { PostComment } from './post-comment.entity';
import { PostLike } from './post-like.entity';
import { UserSubscription } from './user-subscription.entity';

type FeedScope = 'all' | 'subscribed' | 'mine' | 'user';

type CreatePostInput = {
  content: string;
  title?: string;
  imageUrls?: string[];
  contentBlocks?: CommunityContentBlock[];
  caption?: string;
  stockTags?: StockTag[];
};

type CreateCommentInput = {
  content: string;
  parentId?: string;
};

export type CommunityUserDto = {
  id: string;
  nickname: string;
  email: string;
  isMe: boolean;
  isSubscribed: boolean;
  subscriberCount: number;
  followingCount: number;
  postCount: number;
};

export type CommunityCommentDto = {
  id: string;
  content: string;
  author: Pick<CommunityUserDto, 'id' | 'nickname'>;
  createdAt: Date;
  replies: CommunityCommentDto[];
};

export type CommunityPostDto = {
  id: string;
  title: string | null;
  content: string;
  contentBlocks: CommunityContentBlock[];
  imageUrls: string[];
  caption: string;
  stockTags: StockTag[];
  author: Pick<CommunityUserDto, 'id' | 'nickname'>;
  createdAt: Date;
  updatedAt: Date;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  comments: CommunityCommentDto[];
};

export type StockTag = {
  symbol: string;
  name: string;
  market: 'US' | 'KR';
};

export type CommunityContentBlock = {
  id: string;
  type: 'text' | 'image';
  text?: string;
  url?: string;
};

@Injectable()
export class CommunityService {
  private readonly logger = new Logger(CommunityService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(CommunityPost)
    private readonly postsRepository: Repository<CommunityPost>,
    @InjectRepository(PostLike)
    private readonly likesRepository: Repository<PostLike>,
    @InjectRepository(PostComment)
    private readonly commentsRepository: Repository<PostComment>,
    @InjectRepository(UserSubscription)
    private readonly subscriptionsRepository: Repository<UserSubscription>,
    private readonly notifications: NotificationsService,
  ) {}

  async getFeed(
    currentUserId: string,
    scope: FeedScope = 'all',
    userId?: string,
    sort: 'latest' | 'popular' = 'latest',
    page?: { limit?: number; offset?: number },
  ): Promise<CommunityPostDto[]> {
    const authorIds = await this.resolveFeedAuthorIds(
      currentUserId,
      scope,
      userId,
    );
    if (authorIds.length === 0) {
      return [];
    }

    const limit =
      page?.limit !== undefined && Number.isFinite(page.limit)
        ? Math.min(Math.max(Math.trunc(page.limit), 1), 50)
        : undefined;
    const offset =
      page?.offset !== undefined && Number.isFinite(page.offset)
        ? Math.max(Math.trunc(page.offset), 0)
        : 0;

    if (sort === 'popular') {
      // 인기순은 점수 기반 정렬이라 후보를 모아 정렬한 뒤 페이지 구간을 잘라낸다.
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const posts = await this.postsRepository.find({
        where: {
          author: { id: In(authorIds) },
          createdAt: MoreThanOrEqual(new Date(cutoff)),
        },
        order: { createdAt: 'DESC' },
        take: 500,
      });
      const sorted = (await this.toPostDtos(posts, currentUserId))
        .filter((post) => new Date(post.createdAt).getTime() >= cutoff)
        .sort(
          (a, b) =>
            b.likeCount * 0.7 +
              b.commentCount * 0.3 -
              (a.likeCount * 0.7 + a.commentCount * 0.3) ||
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      return limit !== undefined
        ? sorted.slice(offset, offset + limit)
        : sorted;
    }

    // 최신순은 DB 레벨에서 skip/take로 페이지네이션한다.
    const posts = await this.postsRepository.find({
      where: { author: { id: In(authorIds) } },
      order: { createdAt: 'DESC' },
      ...(limit !== undefined ? { skip: offset, take: limit } : { take: 100 }),
    });
    return this.toPostDtos(posts, currentUserId);
  }

  async createPost(
    currentUserId: string,
    input: CreatePostInput,
  ): Promise<CommunityPostDto> {
    const content = input.content?.trim();
    const title = input.title?.trim().slice(0, 160) || null;
    const contentBlocks = this.normalizeContentBlocks(
      input.contentBlocks ?? [],
    );
    const imageUrls = (input.imageUrls ?? [])
      .filter((url) => typeof url === 'string' && url.startsWith('data:image/'))
      .slice(0, 4);
    const caption = input.caption?.trim().slice(0, 2000) ?? '';
    const stockTags = this.normalizeStockTags(input.stockTags ?? []);

    if (
      !title &&
      !content &&
      !caption &&
      imageUrls.length === 0 &&
      contentBlocks.length === 0
    ) {
      throw new BadRequestException('Post content or image is required.');
    }

    const author = await this.findApprovedUser(currentUserId);
    const post = await this.postsRepository.save(
      this.postsRepository.create({
        author,
        title,
        content: content || this.blocksToPlainText(contentBlocks),
        contentBlocks,
        imageUrls,
        caption,
        stockTags,
      }),
    );
    void this.notifySubscribers(post).catch((error) =>
      this.logNotificationFailure('new post', error),
    );

    return (await this.toPostDtos([post], currentUserId))[0];
  }

  async getPost(
    currentUserId: string,
    postId: string,
  ): Promise<CommunityPostDto> {
    const post = await this.findPost(postId);
    return (await this.toPostDtos([post], currentUserId))[0];
  }

  async updatePost(
    currentUserId: string,
    postId: string,
    input: CreatePostInput,
  ): Promise<CommunityPostDto> {
    const post = await this.findPost(postId);
    this.assertOwner(post.author.id, currentUserId);
    const contentBlocks = this.normalizeContentBlocks(
      input.contentBlocks ?? [],
    );
    post.title = input.title?.trim().slice(0, 160) || null;
    post.content =
      input.content?.trim() || this.blocksToPlainText(contentBlocks);
    post.contentBlocks = contentBlocks;
    post.imageUrls = (input.imageUrls ?? [])
      .filter((url) => typeof url === 'string' && url.startsWith('data:image/'))
      .slice(0, 4);
    post.caption = input.caption?.trim().slice(0, 2000) ?? '';
    post.stockTags = this.normalizeStockTags(input.stockTags ?? []);
    await this.postsRepository.save(post);
    return (await this.toPostDtos([post], currentUserId))[0];
  }

  async deletePost(
    currentUserId: string,
    postId: string,
  ): Promise<{ ok: true }> {
    const post = await this.findPost(postId);
    await this.assertOwnerOrAdmin(post.author.id, currentUserId);
    await this.postsRepository.remove(post);
    return { ok: true };
  }

  async getRelatedPosts(
    currentUserId: string,
    symbol: string,
  ): Promise<CommunityPostDto[]> {
    const normalizedSymbol = symbol.toUpperCase().trim();
    if (!normalizedSymbol) {
      return [];
    }
    const posts = await this.postsRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .where(`post.stock_tags::jsonb @> :tag::jsonb`, {
        tag: JSON.stringify([{ symbol: normalizedSymbol }]),
      })
      .orderBy('post.created_at', 'DESC')
      .take(3)
      .getMany();
    return this.toPostDtos(posts, currentUserId);
  }

  async toggleLike(
    currentUserId: string,
    postId: string,
  ): Promise<{ liked: boolean; likeCount: number }> {
    const [user, post] = await Promise.all([
      this.findApprovedUser(currentUserId),
      this.findPost(postId),
    ]);
    const existing = await this.likesRepository.findOne({
      where: { post: { id: post.id }, user: { id: user.id } },
    });

    if (existing) {
      await this.likesRepository.remove(existing);
    } else {
      await this.likesRepository.save(
        this.likesRepository.create({ post, user }),
      );
    }

    return {
      liked: !existing,
      likeCount: await this.likesRepository.count({
        where: { post: { id: post.id } },
      }),
    };
  }

  async createComment(
    currentUserId: string,
    postId: string,
    input: CreateCommentInput,
  ): Promise<CommunityPostDto> {
    const content = input.content?.trim();
    if (!content) {
      throw new BadRequestException('Comment content is required.');
    }

    const [author, post] = await Promise.all([
      this.findApprovedUser(currentUserId),
      this.findPost(postId),
    ]);
    const parent = input.parentId
      ? await this.commentsRepository.findOne({
          where: { id: input.parentId, post: { id: post.id } },
        })
      : null;

    if (input.parentId && !parent) {
      throw new NotFoundException('Parent comment not found.');
    }

    const comment = await this.commentsRepository.save(
      this.commentsRepository.create({
        post,
        author,
        parent: parent?.parent ? parent.parent : parent,
        content,
      }),
    );
    void this.notifyComment(comment, post, parent).catch((error) =>
      this.logNotificationFailure('comment', error),
    );

    return (await this.toPostDtos([post], currentUserId))[0];
  }

  async updateComment(
    currentUserId: string,
    commentId: string,
    content: string,
  ): Promise<CommunityPostDto> {
    const comment = await this.findComment(commentId);
    this.assertOwner(comment.author.id, currentUserId);
    if (!content?.trim()) {
      throw new BadRequestException('Comment content is required.');
    }
    comment.content = content.trim();
    await this.commentsRepository.save(comment);
    return (await this.toPostDtos([comment.post], currentUserId))[0];
  }

  async deleteComment(
    currentUserId: string,
    commentId: string,
  ): Promise<CommunityPostDto> {
    const comment = await this.findComment(commentId);
    await this.assertOwnerOrAdmin(comment.author.id, currentUserId);
    const post = comment.post;
    await this.commentsRepository.remove(comment);
    return (await this.toPostDtos([post], currentUserId))[0];
  }

  async getUsers(currentUserId: string): Promise<CommunityUserDto[]> {
    const users = await this.usersRepository.find({
      where: { status: UserStatus.Approved },
      order: { nickname: 'ASC' },
    });
    const subscriptions = await this.subscriptionsRepository.find({
      where: { subscriber: { id: currentUserId } },
    });
    const subscribedIds = new Set(
      subscriptions.map((subscription) => subscription.creator.id),
    );

    return Promise.all(
      users
        .filter(
          (user) => user.id !== currentUserId && !subscribedIds.has(user.id),
        )
        .slice(0, 3)
        .map(async (user) => ({
          id: user.id,
          nickname: user.nickname,
          email: user.email,
          isMe: user.id === currentUserId,
          isSubscribed: subscribedIds.has(user.id),
          subscriberCount: await this.subscriptionsRepository.count({
            where: { creator: { id: user.id } },
          }),
          followingCount: await this.subscriptionsRepository.count({
            where: { subscriber: { id: user.id } },
          }),
          postCount: await this.postsRepository.count({
            where: { author: { id: user.id } },
          }),
        })),
    );
  }

  async getUser(
    currentUserId: string,
    targetId: string,
  ): Promise<CommunityUserDto> {
    const user = await this.usersRepository.findOne({
      where: { id: targetId, status: UserStatus.Approved },
    });
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    const isSubscribed =
      (await this.subscriptionsRepository.count({
        where: { subscriber: { id: currentUserId }, creator: { id: targetId } },
      })) > 0;
    return {
      id: user.id,
      nickname: user.nickname,
      email: user.email,
      isMe: user.id === currentUserId,
      isSubscribed,
      subscriberCount: await this.subscriptionsRepository.count({
        where: { creator: { id: targetId } },
      }),
      followingCount: await this.subscriptionsRepository.count({
        where: { subscriber: { id: targetId } },
      }),
      postCount: await this.postsRepository.count({
        where: { author: { id: targetId } },
      }),
    };
  }

  async toggleSubscription(
    currentUserId: string,
    creatorId: string,
  ): Promise<{ subscribed: boolean }> {
    if (currentUserId === creatorId) {
      throw new BadRequestException('You cannot subscribe to yourself.');
    }

    const [subscriber, creator] = await Promise.all([
      this.findApprovedUser(currentUserId),
      this.findApprovedUser(creatorId),
    ]);
    const existing = await this.subscriptionsRepository.findOne({
      where: { subscriber: { id: subscriber.id }, creator: { id: creator.id } },
    });

    if (existing) {
      await this.subscriptionsRepository.remove(existing);
      return { subscribed: false };
    }

    await this.subscriptionsRepository.save(
      this.subscriptionsRepository.create({ subscriber, creator }),
    );
    return { subscribed: true };
  }

  private async notifySubscribers(post: CommunityPost): Promise<void> {
    const subscriptions = await this.subscriptionsRepository.find({
      where: { creator: { id: post.author.id } },
    });
    const body = this.firstSentence(post.content || post.caption || 'New post');
    await this.notifications.sendToUsers(
      subscriptions.map((item) => item.subscriber.id),
      {
        type: 'NEW_POST',
        title: `${post.author.nickname}\uB2D8\uC758 \uC0C8 \uAC8C\uC2DC\uAE00`,
        body: `${post.title || body}`,
        url: `/community/${post.id}`,
        data: { postId: post.id, authorId: post.author.id },
        tag: `new-post:${post.id}`,
      },
      (userId) => `new-post:${post.id}:${userId}`,
    );
  }

  private async notifyComment(
    comment: PostComment,
    post: CommunityPost,
    parent: PostComment | null,
  ): Promise<void> {
    const recipientId = parent?.author.id ?? post.author.id;
    if (recipientId === comment.author.id) return;
    await this.notifications.sendToUser(
      recipientId,
      {
        type: 'COMMENT',
        title: `${comment.author.nickname}\uB2D8\uC758 ${parent ? '\uC0C8 \uB2F5\uAE00' : '\uC0C8 \uB313\uAE00'}`,
        body: `${comment.content.slice(0, 160)}`,
        url: `/community/${post.id}`,
        data: { postId: post.id, commentId: comment.id },
        tag: `comment:${comment.id}`,
      },
      `comment:${comment.id}:${recipientId}`,
    );
  }

  private firstSentence(value: string): string {
    const plain = value
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const match = plain.match(/^.*?[.!?](?:\s|$)/);
    return (match?.[0] ?? plain).slice(0, 180);
  }

  private logNotificationFailure(kind: string, error: unknown): void {
    this.logger.warn(
      `${kind} notification failed: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  }

  private async resolveFeedAuthorIds(
    currentUserId: string,
    scope: FeedScope,
    userId?: string,
  ): Promise<string[]> {
    if (scope === 'mine') {
      return [currentUserId];
    }

    if (scope === 'user' && userId) {
      return [userId];
    }

    if (scope === 'subscribed') {
      const subscriptions = await this.subscriptionsRepository.find({
        where: { subscriber: { id: currentUserId } },
      });
      return subscriptions.map((subscription) => subscription.creator.id);
    }

    const users = await this.usersRepository.find({
      where: { status: UserStatus.Approved },
      select: { id: true },
    });
    return users.map((user) => user.id);
  }

  private async toPostDtos(
    posts: CommunityPost[],
    currentUserId: string,
  ): Promise<CommunityPostDto[]> {
    if (posts.length === 0) {
      return [];
    }

    const postIds = posts.map((post) => post.id);
    const [likes, comments] = await Promise.all([
      this.likesRepository.find({
        where: { post: { id: In(postIds) } },
        relations: { post: true },
      }),
      this.commentsRepository.find({
        where: { post: { id: In(postIds) } },
        relations: { post: true, parent: true },
        order: { createdAt: 'ASC' },
      }),
    ]);
    const likesByPost = new Map<string, PostLike[]>();
    likes.forEach((like) => {
      const postLikes = likesByPost.get(like.post.id) ?? [];
      postLikes.push(like);
      likesByPost.set(like.post.id, postLikes);
    });
    const commentsByPost = new Map<string, PostComment[]>();
    comments.forEach((comment) => {
      const postComments = commentsByPost.get(comment.post.id) ?? [];
      postComments.push(comment);
      commentsByPost.set(comment.post.id, postComments);
    });

    return posts.map((post) => {
      const postLikes = likesByPost.get(post.id) ?? [];
      const postComments = commentsByPost.get(post.id) ?? [];
      return {
        id: post.id,
        title: post.title ?? null,
        content: post.content,
        contentBlocks: this.resolveContentBlocks(post),
        imageUrls: post.imageUrls ?? [],
        caption: post.caption ?? '',
        stockTags: post.stockTags ?? [],
        author: {
          id: post.author.id,
          nickname: post.author.nickname,
        },
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        likeCount: postLikes.length,
        commentCount: postComments.length,
        likedByMe: postLikes.some((like) => like.user.id === currentUserId),
        comments: this.toCommentTree(postComments),
      };
    });
  }

  private toCommentTree(comments: PostComment[]): CommunityCommentDto[] {
    const rootComments = comments.filter((comment) => !comment.parent);
    const repliesByParent = new Map<string, PostComment[]>();
    comments
      .filter((comment) => !!comment.parent)
      .forEach((comment) => {
        const replies = repliesByParent.get(comment.parent!.id) ?? [];
        replies.push(comment);
        repliesByParent.set(comment.parent!.id, replies);
      });

    return rootComments.map((comment) => ({
      id: comment.id,
      content: comment.content,
      author: {
        id: comment.author.id,
        nickname: comment.author.nickname,
      },
      createdAt: comment.createdAt,
      replies: (repliesByParent.get(comment.id) ?? []).map((reply) => ({
        id: reply.id,
        content: reply.content,
        author: {
          id: reply.author.id,
          nickname: reply.author.nickname,
        },
        createdAt: reply.createdAt,
        replies: [],
      })),
    }));
  }

  private normalizeContentBlocks(
    blocks: CommunityContentBlock[],
  ): CommunityContentBlock[] {
    const normalized: CommunityContentBlock[] = [];

    blocks.forEach((block, index) => {
      if (normalized.length >= 80) {
        return;
      }

      if (block.type === 'image' && block.url?.startsWith('data:image/')) {
        normalized.push({
          id: block.id || `image-${index}`,
          type: 'image' as const,
          url: block.url,
        });
        return;
      }

      const text = block.text?.trim();
      if (block.type === 'text' && text) {
        normalized.push({
          id: block.id || `text-${index}`,
          type: 'text',
          text,
        });
      }
    });

    return normalized;
  }

  private resolveContentBlocks(post: CommunityPost): CommunityContentBlock[] {
    if (post.contentBlocks?.length) {
      return post.contentBlocks;
    }

    const blocks: CommunityContentBlock[] = [];
    if (post.content) {
      blocks.push({
        id: `${post.id}-text`,
        type: 'text',
        text: post.content,
      });
    }

    (post.imageUrls ?? []).forEach((url, index) => {
      blocks.push({
        id: `${post.id}-image-${index}`,
        type: 'image',
        url,
      });
    });

    return blocks;
  }

  private blocksToPlainText(blocks: CommunityContentBlock[]): string {
    return blocks
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .filter(Boolean)
      .join('\n\n');
  }

  private normalizeStockTags(tags: StockTag[]): StockTag[] {
    const unique = new Map<string, StockTag>();
    tags.slice(0, 10).forEach((tag) => {
      const symbol = tag.symbol?.toUpperCase().trim();
      const name = tag.name?.trim();
      if (symbol && name && (tag.market === 'US' || tag.market === 'KR')) {
        unique.set(symbol, { symbol, name, market: tag.market });
      }
    });
    return [...unique.values()];
  }

  private async findApprovedUser(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });

    if (!user || user.status !== UserStatus.Approved) {
      throw new NotFoundException('Approved user not found.');
    }

    return user;
  }

  private async findPost(id: string): Promise<CommunityPost> {
    const post = await this.postsRepository.findOne({ where: { id } });

    if (!post) {
      throw new NotFoundException('Post not found.');
    }

    return post;
  }

  private async findComment(id: string): Promise<PostComment> {
    const comment = await this.commentsRepository.findOne({
      where: { id },
      relations: { post: true },
    });
    if (!comment) {
      throw new NotFoundException('Comment not found.');
    }
    return comment;
  }

  private assertOwner(ownerId: string, currentUserId: string): void {
    if (ownerId !== currentUserId) {
      throw new ForbiddenException('Only the author can modify this content.');
    }
  }

  private async assertOwnerOrAdmin(
    ownerId: string,
    currentUserId: string,
  ): Promise<void> {
    if (ownerId === currentUserId) {
      return;
    }
    const currentUser = await this.usersRepository.findOne({
      where: { id: currentUserId },
      select: { id: true, role: true },
    });
    if (currentUser?.role !== UserRole.Admin) {
      throw new ForbiddenException(
        'Only the author or an admin can delete this content.',
      );
    }
  }
}
