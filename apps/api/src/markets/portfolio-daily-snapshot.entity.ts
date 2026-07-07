import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity({ name: 'portfolio_daily_snapshots' })
@Unique(['portfolioId', 'snapshotDate'])
@Index(['portfolioId', 'snapshotDate'])
export class PortfolioDailySnapshotEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'portfolio_id', type: 'uuid' }) portfolioId: string;
  @Column({ name: 'snapshot_date', type: 'date' }) snapshotDate: string;
  @Column({ name: 'value_krw', type: 'numeric', precision: 24, scale: 6 }) valueKrw: string;
  @Column({ name: 'cost_krw', type: 'numeric', precision: 24, scale: 6 }) costKrw: string;
  @Column({ name: 'usd_krw', type: 'numeric', precision: 18, scale: 6, nullable: true }) usdKrw: string | null;
  @Column({ name: 'spy_close', type: 'numeric', precision: 18, scale: 6, nullable: true }) spyClose: string | null;
  @Column({ name: 'qqq_close', type: 'numeric', precision: 18, scale: 6, nullable: true }) qqqClose: string | null;
  @Column({ name: 'kospi_close', type: 'numeric', precision: 18, scale: 6, nullable: true }) kospiClose: string | null;
  @Column({ default: false }) estimated: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
