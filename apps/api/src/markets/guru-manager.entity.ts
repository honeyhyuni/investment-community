import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { GuruHoldingEntity } from './guru-holding.entity';

@Entity({ name: 'guru_managers' })
@Index(['sortOrder'])
export class GuruManagerEntity {
  @PrimaryColumn()
  id: string;

  @Column({ unique: true })
  slug: string;

  @Column({ name: 'person_name' })
  personName: string;

  @Column({ name: 'firm_name' })
  firmName: string;

  @Column({ unique: true })
  cik: string;

  @Column({ name: 'sort_order', type: 'integer' })
  sortOrder: number;

  @Column({ name: 'report_date', type: 'date', nullable: true })
  reportDate: string | null;

  @Column({ name: 'filing_date', type: 'date', nullable: true })
  filingDate: string | null;

  @Column({ name: 'accession_number', type: 'varchar', nullable: true })
  accessionNumber: string | null;

  @Column({ name: 'total_value', type: 'double precision', default: 0 })
  totalValue: number;

  @Column({ name: 'position_count', type: 'integer', default: 0 })
  positionCount: number;

  @Column({ default: true })
  enabled: boolean;

  @OneToMany(() => GuruHoldingEntity, (holding) => holding.manager)
  holdings: GuruHoldingEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
