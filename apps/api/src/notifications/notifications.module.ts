import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppNotificationEntity } from './app-notification.entity';
import { NotificationDeliveryEntity } from './notification-delivery.entity';
import { NotificationPreferenceEntity } from './notification-preference.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PushSubscriptionEntity } from './push-subscription.entity';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      PushSubscriptionEntity,
      NotificationPreferenceEntity,
      AppNotificationEntity,
      NotificationDeliveryEntity,
    ]),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
