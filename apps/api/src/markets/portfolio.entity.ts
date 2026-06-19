import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { PortfolioPositionEntity } from './portfolio-position.entity';

@Entity({ name: 'portfolios' })
@Unique(['userId', 'name'])
@Index(['userId', 'createdAt'])
/** User-owned portfolio container. Positions are stored separately for N:M stock composition. */
export class PortfolioEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @OneToMany(() => PortfolioPositionEntity, (position) => position.portfolio)
  positions: PortfolioPositionEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
