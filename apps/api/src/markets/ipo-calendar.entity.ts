import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'ipo_calendar_items' })
@Index(['subscriptionStartDate'])
@Index(['subscriptionEndDate'])
@Index(['listingDate'])
@Index(['receiptDate'])
export class IpoCalendarEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'corp_code', type: 'varchar', nullable: true })
  corpCode: string | null;

  @Column({ name: 'corp_name', type: 'varchar' })
  corpName: string;

  @Column({ name: 'stock_code', type: 'varchar', nullable: true })
  stockCode: string | null;

  @Column({ name: 'report_name', type: 'varchar' })
  reportName: string;

  @Column({ name: 'receipt_no', type: 'varchar', unique: true })
  receiptNo: string;

  @Column({ name: 'receipt_date', type: 'date' })
  receiptDate: string;

  @Column({ name: 'subscription_start_date', type: 'date', nullable: true })
  subscriptionStartDate: string | null;

  @Column({ name: 'subscription_end_date', type: 'date', nullable: true })
  subscriptionEndDate: string | null;

  @Column({ name: 'subscription_date_text', type: 'varchar', nullable: true })
  subscriptionDateText: string | null;

  @Column({ name: 'listing_date', type: 'date', nullable: true })
  listingDate: string | null;

  @Column({ name: 'listing_date_text', type: 'varchar', nullable: true })
  listingDateText: string | null;

  @Column({ name: 'expected_offer_price', type: 'varchar', nullable: true })
  expectedOfferPrice: string | null;

  @Column({ name: 'confirmed_offer_price', type: 'varchar', nullable: true })
  confirmedOfferPrice: string | null;

  @Column({ name: 'underwriter', type: 'varchar', nullable: true })
  underwriter: string | null;

  @Column({ name: 'dart_url', type: 'text' })
  dartUrl: string;

  @Column({ type: 'varchar', default: 'dart_disclosure_batch' })
  source: string;

  @Column({ type: 'simple-json', nullable: true })
  raw: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
