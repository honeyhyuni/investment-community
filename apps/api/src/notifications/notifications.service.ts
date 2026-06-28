import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import webPush, { WebPushError } from 'web-push';
import { IsNull, Repository } from 'typeorm';
import { AppNotificationEntity } from './app-notification.entity';
import { NotificationDeliveryEntity } from './notification-delivery.entity';
import { NotificationPreferenceEntity } from './notification-preference.entity';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NotificationPreferences,
  NotificationType,
  preferenceKeyForType,
} from './notification-types';
import { PushSubscriptionEntity } from './push-subscription.entity';

export type NotificationMessage = {
  type: NotificationType;
  title: string;
  body: string;
  url: string;
  data?: Record<string, unknown>;
  tag?: string;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly vapidPublicKey: string | null;
  private readonly pushEnabled: boolean;
  private readonly testPushEnabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(PushSubscriptionEntity)
    private readonly subscriptions: Repository<PushSubscriptionEntity>,
    @InjectRepository(NotificationPreferenceEntity)
    private readonly preferences: Repository<NotificationPreferenceEntity>,
    @InjectRepository(AppNotificationEntity)
    private readonly notifications: Repository<AppNotificationEntity>,
    @InjectRepository(NotificationDeliveryEntity)
    private readonly deliveries: Repository<NotificationDeliveryEntity>,
  ) {
    this.vapidPublicKey =
      this.configService.get<string>('VAPID_PUBLIC_KEY') ?? null;
    const privateKey =
      this.configService.get<string>('VAPID_PRIVATE_KEY') ?? null;
    const subject =
      this.configService.get<string>('VAPID_SUBJECT') ??
      'mailto:admin@15f.kro.kr';
    this.pushEnabled =
      this.configService.get<string>('ENABLE_WEB_PUSH') === 'true';
    this.testPushEnabled =
      this.configService.get<string>('ENABLE_PUSH_TEST_API') === 'true';
    if (this.vapidPublicKey && privateKey) {
      webPush.setVapidDetails(subject, this.vapidPublicKey, privateKey);
    }
  }

  getPublicConfig(): { publicKey: string | null; enabled: boolean } {
    return {
      publicKey: this.vapidPublicKey,
      enabled:
        (this.pushEnabled || this.testPushEnabled) && !!this.vapidPublicKey,
    };
  }

  async subscribe(
    userId: string,
    input: {
      endpoint: string;
      keys: { p256dh: string; auth: string };
      userAgent?: string;
    },
  ): Promise<{ ok: true }> {
    await this.subscriptions.upsert(
      {
        userId,
        endpoint: input.endpoint,
        p256dhKey: input.keys.p256dh,
        authKey: input.keys.auth,
        userAgent: input.userAgent?.slice(0, 1000) ?? null,
      },
      ['endpoint'],
    );
    await this.ensurePreferences(userId);
    return { ok: true };
  }

  async unsubscribe(userId: string, endpoint: string): Promise<{ ok: true }> {
    await this.subscriptions.delete({ userId, endpoint });
    return { ok: true };
  }

  async getPreferences(userId: string): Promise<NotificationPreferences> {
    return this.toPreferences(await this.ensurePreferences(userId));
  }

  async updatePreferences(
    userId: string,
    patch: Partial<NotificationPreferences>,
  ): Promise<NotificationPreferences> {
    const current = await this.ensurePreferences(userId);
    Object.assign(current, patch);
    return this.toPreferences(await this.preferences.save(current));
  }

  async list(
    userId: string,
    limit = 30,
  ): Promise<{ items: AppNotificationEntity[]; unreadCount: number }> {
    const [items, unreadCount] = await Promise.all([
      this.notifications.find({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: Math.min(Math.max(limit, 1), 100),
      }),
      this.notifications.count({ where: { userId, readAt: IsNull() } }),
    ]);
    return { items, unreadCount };
  }

  async markRead(userId: string, id?: string): Promise<{ ok: true }> {
    const query = this.notifications
      .createQueryBuilder()
      .update()
      .set({ readAt: new Date() })
      .where('user_id = :userId', { userId })
      .andWhere('read_at is null');
    if (id) query.andWhere('id = :id', { id });
    await query.execute();
    return { ok: true };
  }

  async sendTest(userId: string): Promise<{ ok: true }> {
    if (!this.testPushEnabled) {
      throw new ForbiddenException('Push test API is disabled.');
    }
    const message: NotificationMessage = {
      type: 'MARKET_BRIEFING',
      title: '15F test notification',
      body: 'Web Push subscription and delivery are working.',
      url: '/profile',
      data: { test: true },
      tag: 'push-test',
    };
    const notification = await this.notifications.save(
      this.notifications.create({
        userId,
        ...message,
        data: message.data ?? {},
        readAt: null,
      }),
    );
    await this.sendPush(
      userId,
      { ...message, notificationId: notification.id },
      true,
    );
    return { ok: true };
  }

  async sendToUser(
    userId: string,
    message: NotificationMessage,
    dedupeKey?: string,
  ): Promise<boolean> {
    if (!(await this.isEnabled(userId, message.type))) return false;
    if (dedupeKey && !(await this.claimDelivery(userId, dedupeKey, message))) {
      return false;
    }
    const notification = await this.notifications.save(
      this.notifications.create({
        userId,
        type: message.type,
        title: message.title.slice(0, 240),
        body: message.body,
        url: message.url,
        data: message.data ?? {},
        readAt: null,
      }),
    );
    await this.sendPush(userId, {
      ...message,
      notificationId: notification.id,
    });
    return true;
  }

  async sendToUsers(
    userIds: string[],
    message: NotificationMessage,
    dedupeKey?: (userId: string) => string,
  ): Promise<void> {
    await Promise.allSettled(
      [...new Set(userIds)].map((userId) =>
        this.sendToUser(userId, message, dedupeKey?.(userId)),
      ),
    );
  }

  async claimDelivery(
    userId: string | null,
    dedupeKey: string,
    message: Pick<NotificationMessage, 'type' | 'data'>,
  ): Promise<boolean> {
    try {
      await this.deliveries.save(
        this.deliveries.create({
          userId,
          dedupeKey,
          kind: message.type,
          metadata: message.data ?? {},
        }),
      );
      return true;
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505'
      ) {
        return false;
      }
      throw error;
    }
  }

  private async ensurePreferences(
    userId: string,
  ): Promise<NotificationPreferenceEntity> {
    const existing = await this.preferences.findOne({ where: { userId } });
    if (existing) return existing;
    return this.preferences.save(
      this.preferences.create({ userId, ...DEFAULT_NOTIFICATION_PREFERENCES }),
    );
  }

  private async isEnabled(
    userId: string,
    type: NotificationType,
  ): Promise<boolean> {
    const preference = await this.ensurePreferences(userId);
    return preference[preferenceKeyForType(type)];
  }

  private async sendPush(
    userId: string,
    payload: NotificationMessage & { notificationId: string },
    force = false,
  ): Promise<void> {
    if ((!this.pushEnabled && !force) || !this.vapidPublicKey) return;
    const subscriptions = await this.subscriptions.find({ where: { userId } });
    await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        try {
          await webPush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dhKey,
                auth: subscription.authKey,
              },
            },
            JSON.stringify(payload),
            { TTL: 60 * 60, urgency: 'normal' },
          );
        } catch (error) {
          const statusCode =
            error instanceof WebPushError ? error.statusCode : undefined;
          if (statusCode === 404 || statusCode === 410) {
            await this.subscriptions.delete({ id: subscription.id });
            return;
          }
          this.logger.warn(
            `Push delivery failed for user ${userId}: ${
              error instanceof Error ? error.message : 'unknown error'
            }`,
          );
        }
      }),
    );
  }

  private toPreferences(
    row: NotificationPreferenceEntity,
  ): NotificationPreferences {
    return {
      priceEnabled: row.priceEnabled,
      earningsEnabled: row.earningsEnabled,
      ipoEnabled: row.ipoEnabled,
      communityEnabled: row.communityEnabled,
      newPostEnabled: row.newPostEnabled,
      marketBriefingEnabled: row.marketBriefingEnabled,
    };
  }
}
