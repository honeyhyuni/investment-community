import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export type GuruSecDatasetStatus = 'discovered' | 'downloaded' | 'parsed' | 'applied' | 'failed';

@Entity({ name: 'guru_sec_datasets' })
@Index(['status'])
@Index(['datasetLabel'])
export class GuruSecDatasetEntity {
  @PrimaryColumn()
  id: string;

  @Column({ name: 'dataset_url', unique: true })
  datasetUrl: string;

  @Column({ name: 'dataset_label' })
  datasetLabel: string;

  @Column({ name: 'file_name' })
  fileName: string;

  @Column({ name: 'file_path', type: 'varchar', nullable: true })
  filePath: string | null;

  @Column({ type: 'varchar', nullable: true })
  sha256: string | null;

  @Column({ name: 'file_size', type: 'integer', nullable: true })
  fileSize: number | null;

  @Column({ type: 'varchar', default: 'discovered' })
  status: GuruSecDatasetStatus;

  @Column({ name: 'downloaded_at', type: 'timestamptz', nullable: true })
  downloadedAt: Date | null;

  @Column({ name: 'parsed_at', type: 'timestamptz', nullable: true })
  parsedAt: Date | null;

  @Column({ name: 'applied_at', type: 'timestamptz', nullable: true })
  appliedAt: Date | null;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
