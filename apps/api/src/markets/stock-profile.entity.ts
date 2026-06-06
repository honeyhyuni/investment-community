import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'stock_profiles' })
export class StockProfileEntity {
  @PrimaryColumn()
  symbol: string;

  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  @Column({ type: 'varchar', nullable: true })
  exchange: string | null;

  @Column({ type: 'varchar', nullable: true })
  currency: string | null;

  @Column({ type: 'varchar', nullable: true })
  country: string | null;

  @Column({ type: 'varchar', nullable: true })
  ipo: string | null;

  @Column({ type: 'varchar', nullable: true })
  industry: string | null;

  @Column({ type: 'varchar', nullable: true })
  website: string | null;

  @Column({ type: 'varchar', nullable: true })
  logo: string | null;

  @Column({ name: 'market_capitalization', type: 'double precision', nullable: true })
  marketCapitalization: number | null;

  @Column({ name: 'share_outstanding', type: 'double precision', nullable: true })
  shareOutstanding: number | null;

  @Column({ name: 'overview_en', type: 'text' })
  overviewEn: string;

  @Column({ name: 'overview_ko', type: 'text' })
  overviewKo: string;

  @Column({ name: 'source', default: 'finnhub_profile2' })
  source: string;

  @Column({ name: 'fetched_at', type: 'timestamptz' })
  fetchedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
