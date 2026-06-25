import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { GuruManagerEntity } from './guru-manager.entity';

@Entity({ name: 'guru_holdings' })
@Index(['managerId', 'weight'])
@Index(['managerId', 'weightChange'])
export class GuruHoldingEntity {
  @PrimaryColumn()
  id: string;

  @Column({ name: 'manager_id' })
  managerId: string;

  @ManyToOne(() => GuruManagerEntity, (manager) => manager.holdings, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'manager_id' })
  manager: GuruManagerEntity;

  @Column()
  cusip: string;

  @Column({ type: 'varchar', nullable: true })
  figi: string | null;

  @Column({ type: 'varchar', nullable: true })
  ticker: string | null;

  @Column({ name: 'put_call', type: 'varchar', nullable: true })
  putCall: string | null;

  @Column({ name: 'issuer_name' })
  issuerName: string;

  @Column({ name: 'class_title' })
  classTitle: string;

  @Column({ type: 'double precision' })
  value: number;

  @Column({ type: 'double precision' })
  shares: number;

  @Column({ type: 'double precision' })
  weight: number;

  @Column({ name: 'previous_value', type: 'double precision', default: 0 })
  previousValue: number;

  @Column({ name: 'previous_shares', type: 'double precision', default: 0 })
  previousShares: number;

  @Column({ name: 'previous_weight', type: 'double precision', default: 0 })
  previousWeight: number;

  @Column({ name: 'weight_change', type: 'double precision', default: 0 })
  weightChange: number;

  @Column({ name: 'share_change', type: 'double precision', default: 0 })
  shareChange: number;

  @Column({ name: 'return_percent', type: 'double precision', nullable: true })
  returnPercent: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
