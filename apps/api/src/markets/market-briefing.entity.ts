import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'market_briefings' })
@Index(['market', 'generatedAt'])
export class MarketBriefingEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 2 })
  market: 'US' | 'KR';

  @Column({ type: 'varchar', length: 240 })
  title: string;

  @Column({ name: 'title_candidates', type: 'simple-json' })
  titleCandidates: string[];

  @Column({ type: 'text' })
  summary: string;

  @Column({ name: 'summary_lines', type: 'simple-json' })
  summaryLines: string[];

  @Column({ name: 'macro_lines', type: 'simple-json', nullable: true })
  macroLines: string[] | null;

  @Column({ name: 'company_news', type: 'simple-json' })
  companyNews: Array<{
    symbol: string;
    name: string;
    headline: string;
    lines: string[];
  }>;

  @Column({ type: 'simple-json' })
  keywords: string[];

  @Column({ name: 'watch_points', type: 'simple-json' })
  watchPoints: string[];

  @Column({ name: 'image_url', type: 'text', nullable: true })
  imageUrl: string | null;

  @Column({ type: 'simple-json' })
  sources: Array<{
    headline: string;
    source: string;
    url: string;
    datetime: number;
  }>;

  @Column({ default: 'openai' })
  source: string;

  @Column()
  model: string;

  @Column({ name: 'image_model', type: 'varchar', nullable: true })
  imageModel: string | null;

  @Column({ name: 'generated_at', type: 'timestamptz' })
  generatedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
