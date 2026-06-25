import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'guru_security_master' })
export class GuruSecurityMasterEntity {
  @PrimaryColumn()
  cusip: string;

  @Column({ type: 'varchar', nullable: true })
  ticker: string | null;

  @Column({ type: 'varchar', nullable: true })
  figi: string | null;

  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  @Column({ type: 'varchar', nullable: true })
  sector: string | null;

  @Column({ type: 'varchar', nullable: true })
  industry: string | null;

  @Column({ name: 'current_price', type: 'double precision', nullable: true })
  currentPrice: number | null;

  @Column({ name: 'price_updated_at', type: 'timestamptz', nullable: true })
  priceUpdatedAt: Date | null;

  @Column({ type: 'varchar' })
  source: string;

  @Column({ name: 'fetched_at', type: 'timestamptz' })
  fetchedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
