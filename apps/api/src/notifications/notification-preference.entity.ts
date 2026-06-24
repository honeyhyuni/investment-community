import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'notification_preferences' })
export class NotificationPreferenceEntity {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'price_enabled', default: false })
  priceEnabled: boolean;

  @Column({ name: 'earnings_enabled', default: true })
  earningsEnabled: boolean;

  @Column({ name: 'ipo_enabled', default: true })
  ipoEnabled: boolean;

  @Column({ name: 'community_enabled', default: false })
  communityEnabled: boolean;

  @Column({ name: 'new_post_enabled', default: false })
  newPostEnabled: boolean;

  @Column({ name: 'market_briefing_enabled', default: true })
  marketBriefingEnabled: boolean;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
