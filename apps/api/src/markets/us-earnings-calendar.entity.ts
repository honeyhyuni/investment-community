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
