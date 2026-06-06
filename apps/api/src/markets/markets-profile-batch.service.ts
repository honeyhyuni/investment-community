import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MarketsService } from './markets.service';

@Injectable()
export class MarketsProfileBatchService {
  private readonly logger = new Logger(MarketsProfileBatchService.name);

  constructor(private readonly marketsService: MarketsService) {}

  @Cron('0 0 2 * * *', { timeZone: 'Asia/Seoul' })
  async refreshDailyProfiles(): Promise<void> {
    const result = await this.marketsService.refreshDefaultProfiles();
    this.logger.log(`Daily stock profile batch updated ${result.updated} profiles.`);
  }
}
