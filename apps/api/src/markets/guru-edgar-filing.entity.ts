import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export type GuruEdgarFilingStatus = 'discovered' | 'downloaded' | 'parsed' | 'applied' | 'failed';

@Entity({ name: 'guru_edgar_filings' })
@Index(['cik'])
@Index(['status'])
@Index(['accessionNumber'], { unique: true })
export class GuruEdgarFilingEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  cik: string;

  @Column({ name: 'accession_number' })
  accessionNumber: string;

  @Column({ name: 'form_type' })
  formType: string;

  @Column({ name: 'filing_date', type: 'date', nullable: true })
  filingDate: string | null;

  @Column({ name: 'report_date', type: 'date', nullable: true })
  reportDate: string | null;

  @Column({ name: 'filing_url' })
  filingUrl: string;

  @Column({ name: 'info_table_url', type: 'varchar', nullable: true })
  infoTableUrl: string | null;

  @Column({ type: 'varchar', default: 'discovered' })
  status: GuruEdgarFilingStatus;

  @Column({ name: 'holdings_count', type: 'integer', default: 0 })
  holdingsCount: number;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  @Column({ name: 'downloaded_at', type: 'timestamptz', nullable: true })
  downloadedAt: Date | null;

  @Column({ name: 'parsed_at', type: 'timestamptz', nullable: true })
  parsedAt: Date | null;

  @Column({ name: 'applied_at', type: 'timestamptz', nullable: true })
  appliedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
