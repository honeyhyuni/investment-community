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
import { NotificationsModule } from '../notifications/notifications.module';
import { MarketNotificationJobsService } from './market-notification-jobs.service';
import { UsStockFinancialEntity } from './us-stock-financial.entity';
import { UsStockFinancialsService } from './us-stock-financials.service';
import { GuruManagerEntity } from './guru-manager.entity';
import { GuruHoldingEntity } from './guru-holding.entity';
import { GuruPortfoliosService } from './guru-portfolios.service';
import { GuruSecurityMasterEntity } from './guru-security-master.entity';

@Module({
  imports: [
    NotificationsModule,
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
      UsStockFinancialEntity,
      GuruManagerEntity,
      GuruHoldingEntity,
      GuruSecurityMasterEntity,
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
    UsStockFinancialsService,
    GuruPortfoliosService,
  ],
})
/** Wires market quotes, stock metadata, financial batches, briefings, and sockets. */
export class MarketsModule {}
