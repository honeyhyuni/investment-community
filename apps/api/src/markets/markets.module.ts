import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketsController } from './markets.controller';
import { MarketsGateway } from './markets.gateway';
import { MarketsProfileBatchService } from './markets-profile-batch.service';
import { MarketsService } from './markets.service';
import { StockMasterBatchService } from './stock-master-batch.service';
import { StockMasterEntity } from './stock-master.entity';
import { StockProfileEntity } from './stock-profile.entity';

@Module({
  imports: [TypeOrmModule.forFeature([StockProfileEntity, StockMasterEntity])],
  controllers: [MarketsController],
  providers: [
    MarketsService,
    MarketsGateway,
    MarketsProfileBatchService,
    StockMasterBatchService,
  ],
})
export class MarketsModule {}
