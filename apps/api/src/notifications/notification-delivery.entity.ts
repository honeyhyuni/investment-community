import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity({ name: 'notification_deliveries' })
@Unique(['dedupeKey'])
@Index(['userId', 'createdAt'])
export class NotificationDeliveryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ name: 'dedupe_key', type: 'varchar', length: 320 })
  dedupeKey: string;

  @Column({ type: 'varchar', length: 32 })
  kind: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
