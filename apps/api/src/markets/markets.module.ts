import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketsController } from './markets.controller';
import { MarketsGateway } from './markets.gateway';
import { MarketsProfileBatchService } from './markets-profile-batch.service';
import { MarketsService } from './markets.service';
import { FavoriteStockEntity } from './favorite-stock.entity';
import { IpoCalendarBatchService } from './ipo-calendar-batch.service';
import { IpoCalendarEntity } from './ipo-calendar.entity';
import { MarketBriefingEntity } from './market-briefing.entity';
import { PortfolioEntity } from './portfolio.entity';
import { PortfolioPositionEntity } from './portfolio-position.entity';
import { StockFinancialBatchService } from './stock-financial-batch.service';
import { StockFinancialEntity } from './stock-financial.entity';
import { StockMasterBatchService } from './stock-master-batch.service';
import { StockMasterEntity } from './stock-master.entity';
import { StockProfileEntity } from './stock-profile.entity';
import { UsEarningsCalendarBatchService } from './us-earnings-calendar-batch.service';
import { UsEarningsCalendarEntity } from './us-earnings-calendar.entity';
import { User } from '../users/user.entity';
import { MarketNotificationJobsService } from './market-notification-jobs.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StockProfileEntity,
      StockMasterEntity,
      StockFinancialEntity,
      MarketBriefingEntity,
      FavoriteStockEntity,
      PortfolioEntity,
      PortfolioPositionEntity,
      IpoCalendarEntity,
      UsEarningsCalendarEntity,
      User,
    ]),
  ],
  controllers: [MarketsController],
  providers: [
    MarketsService,
    MarketsGateway,
    MarketsProfileBatchService,
    StockMasterBatchService,
    StockFinancialBatchService,
    IpoCalendarBatchService,
    UsEarningsCalendarBatchService,
    MarketNotificationJobsService,
  ],
})
/** Wires market quotes, stock metadata, financial batches, briefings, and sockets. */
export class MarketsModule {}
