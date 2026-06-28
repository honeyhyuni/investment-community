import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'us_earnings_calendar' })
@Index(['reportDate'])
@Index(['symbol', 'reportDate'])
@Index(['symbol', 'reportDate', 'fiscalDateEnding'], { unique: true })
export class UsEarningsCalendarEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  symbol: string;

  @Column({ name: 'company_name', type: 'varchar' })
  companyName: string;

  @Column({ name: 'report_date', type: 'date' })
  reportDate: string;

  @Column({ name: 'fiscal_date_ending', type: 'date', nullable: true })
  fiscalDateEnding: string | null;

  @Column({ type: 'double precision', nullable: true })
  estimate: number | null;

  @Column({
    name: 'revenue_estimate',
    type: 'double precision',
    nullable: true,
  })
  revenueEstimate: number | null;

  @Column({ name: 'eps_actual', type: 'double precision', nullable: true })
  epsActual: number | null;

  @Column({ name: 'revenue_actual', type: 'double precision', nullable: true })
  revenueActual: number | null;

  @Column({ name: 'actual_checked_at', type: 'timestamp', nullable: true })
  actualCheckedAt: Date | null;

  @Column({ name: 'estimate_source', type: 'varchar', nullable: true })
  estimateSource: string | null;

  @Column({ name: 'actual_source', type: 'varchar', nullable: true })
  actualSource: string | null;

  @Column({ name: 'finnhub_year', type: 'integer', nullable: true })
  finnhubYear: number | null;

  @Column({ name: 'finnhub_quarter', type: 'integer', nullable: true })
  finnhubQuarter: number | null;

  @Column({ name: 'sec_confirmed_at', type: 'timestamp', nullable: true })
  secConfirmedAt: Date | null;

  @Column({ name: 'sec_financial_id', type: 'varchar', nullable: true })
  secFinancialId: string | null;

  @Column({ type: 'varchar', nullable: true })
  currency: string | null;

  @Column({ name: 'time_of_the_day', type: 'varchar', nullable: true })
  timeOfTheDay: string | null;

  @Column({ name: 'stock_master_id', type: 'varchar', nullable: true })
  stockMasterId: string | null;

  @Column({ type: 'varchar', default: 'alpha_vantage' })
  source: string;

  @Column({ type: 'simple-json', nullable: true })
  raw: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
