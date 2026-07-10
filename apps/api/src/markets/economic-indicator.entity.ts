import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'economic_indicators' })
@Unique(['seriesId', 'observationDate'])
@Index(['observationDate'])
export class EconomicIndicatorEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'series_id', length: 32 }) seriesId: string;
  @Column({ length: 120 }) name: string;
  @Column({ length: 10, default: 'US' }) country: string;
  @Column({ name: 'observation_date', type: 'date' }) observationDate: string;
  @Column({ type: 'numeric', precision: 20, scale: 6, nullable: true }) actual: string | null;
  @Column({ type: 'numeric', precision: 20, scale: 6, nullable: true }) previous: string | null;
  @Column({ type: 'numeric', precision: 20, scale: 6, nullable: true }) expected: string | null;
  @Column({ length: 32 }) unit: string;
  @Column({ length: 16, default: 'high' }) importance: string;
  @Column({ name: 'source_url', length: 500 }) sourceUrl: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}