import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity({ name: 'favorite_stocks' })
@Unique(['userId', 'market', 'symbol'])
@Index(['userId', 'createdAt'])
export class FavoriteStockEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column()
  symbol: string;

  @Column()
  market: 'US' | 'KR';

  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
