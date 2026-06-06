import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'stock_master' })
@Index(['market', 'active'])
export class StockMasterEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  symbol: string;

  @Column()
  name: string;

  @Column()
  market: string;

  @Column()
  exchange: string;

  @Column()
  currency: string;

  @Column()
  country: string;

  @Column({ type: 'varchar', nullable: true })
  type: string | null;

  @Column({ name: 'standard_code', type: 'varchar', nullable: true })
  standardCode: string | null;

  @Column({ name: 'dart_corp_code', type: 'varchar', nullable: true })
  dartCorpCode: string | null;

  @Column({ default: true })
  active: boolean;

  @Column()
  source: string;

  @Column({ name: 'last_seen_at', type: 'timestamptz' })
  lastSeenAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
