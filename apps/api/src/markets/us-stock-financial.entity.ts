import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'us_stock_financials' })
@Index(['symbol', 'periodType', 'fiscalYear', 'fiscalQuarter'], {
  unique: true,
})
export class UsStockFinancialEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  symbol: string;

  @Column({ type: 'varchar' })
  cik: string;

  @Column({ name: 'period_type', type: 'varchar' })
  periodType: 'ANNUAL' | 'QUARTERLY';

  @Column({ name: 'fiscal_year', type: 'integer' })
  fiscalYear: number;

  @Column({ name: 'fiscal_quarter', type: 'integer', default: 0 })
  fiscalQuarter: number;

  @Column({ type: 'double precision', nullable: true })
  revenue: number | null;

  @Column({
    name: 'operating_income',
    type: 'double precision',
    nullable: true,
  })
  operatingIncome: number | null;

  @Column({ name: 'net_income', type: 'double precision', nullable: true })
  netIncome: number | null;

  @Column({ type: 'double precision', nullable: true })
  assets: number | null;

  @Column({ type: 'double precision', nullable: true })
  liabilities: number | null;

  @Column({ type: 'double precision', nullable: true })
  equity: number | null;

  @Column({ type: 'double precision', nullable: true })
  eps: number | null;

  @Column({ name: 'period_start', type: 'date', nullable: true })
  periodStart: string | null;

  @Column({ name: 'period_end', type: 'date' })
  periodEnd: string;

  @Column({ name: 'filed_at', type: 'date', nullable: true })
  filedAt: string | null;

  @Column({ name: 'accession_number', type: 'varchar', nullable: true })
  accessionNumber: string | null;

  @Column({ type: 'varchar', default: 'USD' })
  currency: string;

  @Column({ type: 'varchar', default: 'sec_companyfacts' })
  source: string;

  @Column({ name: 'fetched_at', type: 'timestamptz' })
  fetchedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
