import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketsController } from './markets.controller';
import { MarketsGateway } from './markets.gateway';
import { MarketsProfileBatchService } from './markets-profile-batch.service';
import { MarketsService } from './markets.service';
import { FavoriteStockEntity } from './favorite-stock.entity';
import { MarketBriefingEntity } from './market-briefing.entity';
import { StockFinancialBatchService } from './stock-financial-batch.service';
import { StockFinancialEntity } from './stock-financial.entity';
import { StockMasterBatchService } from './stock-master-batch.service';
import { StockMasterEntity } from './stock-master.entity';
import { StockProfileEntity } from './stock-profile.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StockProfileEntity,
      StockMasterEntity,
      StockFinancialEntity,
      MarketBriefingEntity,
      FavoriteStockEntity,
    ]),
  ],
  controllers: [MarketsController],
  providers: [
    MarketsService,
    MarketsGateway,
    MarketsProfileBatchService,
    StockMasterBatchService,
    StockFinancialBatchService,
  ],
})
/** Wires market quotes, stock metadata, financial batches, briefings, and sockets. */
export class MarketsModule {}
