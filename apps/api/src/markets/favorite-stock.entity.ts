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
/** Join table for a user's US/KR stock watchlist. */
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

  // 사용자가 지정한 표시 순서. 작을수록 위에 표시한다. 새 관심종목은 음수로 내려가며 항상 맨 위에 온다.
  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
