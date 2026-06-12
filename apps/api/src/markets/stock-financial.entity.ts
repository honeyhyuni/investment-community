import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'stock_financials' })
@Index(['symbol', 'fiscalYear'])
export class StockFinancialEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  symbol: string;

  @Column({ name: 'corp_code', type: 'varchar', nullable: true })
  corpCode: string | null;

  @Column({ name: 'fiscal_year', type: 'integer' })
  fiscalYear: number;

  @Column({ name: 'revenue', type: 'double precision', nullable: true })
  revenue: number | null;

  @Column({ name: 'operating_profit', type: 'double precision', nullable: true })
  operatingProfit: number | null;

  @Column({ name: 'net_income', type: 'double precision', nullable: true })
  netIncome: number | null;

  @Column({ name: 'equity', type: 'double precision', nullable: true })
  equity: number | null;

  @Column({ name: 'assets', type: 'double precision', nullable: true })
  assets: number | null;

  @Column({ name: 'eps', type: 'double precision', nullable: true })
  eps: number | null;

  @Column({ name: 'listed_shares', type: 'double precision', nullable: true })
  listedShares: number | null;

  @Column({ name: 'close_price', type: 'double precision', nullable: true })
  closePrice: number | null;

  @Column({ name: 'market_cap', type: 'double precision', nullable: true })
  marketCap: number | null;

  @Column({ name: 'per', type: 'double precision', nullable: true })
  per: number | null;

  @Column({ name: 'pbr', type: 'double precision', nullable: true })
  pbr: number | null;

  @Column({ name: 'psr', type: 'double precision', nullable: true })
  psr: number | null;

  @Column({ name: 'roe', type: 'double precision', nullable: true })
  roe: number | null;

  @Column({ name: 'report_code', type: 'varchar', default: '11011' })
  reportCode: string;

  @Column({ name: 'source', type: 'varchar', default: 'dart_financial_batch' })
  source: string;

  @Column({ name: 'fetched_at', type: 'timestamptz' })
  fetchedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
