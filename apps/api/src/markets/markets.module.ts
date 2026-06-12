import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketsController } from './markets.controller';
import { MarketsGateway } from './markets.gateway';
import { MarketsProfileBatchService } from './markets-profile-batch.service';
import { MarketsService } from './markets.service';
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
export class MarketsModule {}
