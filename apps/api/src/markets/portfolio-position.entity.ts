import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { PortfolioEntity } from './portfolio.entity';

@Entity({ name: 'portfolio_positions' })
@Unique(['portfolioId', 'market', 'symbol'])
@Index(['portfolioId', 'market', 'symbol'])
/** Stock position inside a portfolio. Quantity is user-entered; quote data is resolved at read time. */
export class PortfolioPositionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'portfolio_id', type: 'uuid' })
  portfolioId: string;

  @ManyToOne(() => PortfolioEntity, (portfolio) => portfolio.positions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'portfolio_id' })
  portfolio: PortfolioEntity;

  @Column()
  symbol: string;

  @Column()
  market: 'US' | 'KR';

  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  @Column({ type: 'numeric', precision: 20, scale: 6 })
  quantity: string;

  @Column({ name: 'average_price', type: 'numeric', precision: 20, scale: 6, default: 0 })
  averagePrice: string;

  @Column({ name: 'started_at', type: 'date', nullable: true })
  startedAt: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
