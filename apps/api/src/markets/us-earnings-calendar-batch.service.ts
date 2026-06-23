import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StockMasterEntity } from './stock-master.entity';
import { UsEarningsCalendarEntity } from './us-earnings-calendar.entity';

type AlphaVantageEarningsRow = {
  symbol: string;
  name: string;
  reportDate: string;
  fiscalDateEnding: string;
  estimate: string;
  currency: string;
  timeOfTheDay: string;
};

@Injectable()
export class UsEarningsCalendarBatchService {
  private readonly logger = new Logger(UsEarningsCalendarBatchService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(UsEarningsCalendarEntity)
    private readonly earningsRepository: Repository<UsEarningsCalendarEntity>,
    @InjectRepository(StockMasterEntity)
    private readonly masterRepository: Repository<StockMasterEntity>,
  ) {}

  @Cron('0 20 3 * * *', { timeZone: 'Asia/Seoul' })
  async refreshDailyUsEarnings(): Promise<void> {
    if (!this.isScheduledJobsEnabled()) {
      this.logger.log('Scheduled US earnings calendar disabled.');
      return;
    }

    try {
      const result = await this.refreshUsEarningsCalendar();
      this.logger.log(
        `US earnings calendar batch completed: fetched=${result.fetched}, updated=${result.updated}.`,
      );
    } catch (error) {
      this.logger.warn(
        `US earnings calendar batch failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  async refreshUsEarningsCalendar(): Promise<{
    fetched: number;
    updated: number;
    deleted: number;
  }> {
    const apiKey = this.configService
      .get<string>('ALPHA_VANTAGE_API_KEY')
      ?.trim();
    if (!apiKey) {
      this.logger.warn(
        'US earnings calendar batch skipped: ALPHA_VANTAGE_API_KEY is missing.',
      );
      return { fetched: 0, updated: 0, deleted: 0 };
    }

    const rows = await this.fetchAlphaVantageEarnings(apiKey);
    const validRows = rows.filter((row) => row.symbol && row.reportDate);
    const stockBySymbol = await this.getUsStockMasterBySymbol(
      validRows.map((row) => row.symbol),
    );

    const entities = validRows.map((row) => {
      const symbol = row.symbol.trim().toUpperCase();
      const stock = stockBySymbol.get(symbol);
      return {
        symbol,
        companyName: row.name?.trim() || stock?.name || symbol,
        reportDate: row.reportDate,
        fiscalDateEnding: this.normalizeDate(row.fiscalDateEnding),
        estimate: this.toNumber(row.estimate),
        currency: row.currency?.trim() || null,
        timeOfTheDay: row.timeOfTheDay?.trim() || null,
        stockMasterId: stock?.id ?? null,
        source: 'alpha_vantage',
        raw: row,
      };
    });

    const refreshedRangeDeleted = await this.deleteRefreshedEarningsRange(
      entities.map((entity) => entity.reportDate),
    );

    for (const batch of this.chunk(entities, 500)) {
      await this.earningsRepository.upsert(batch, [
        'symbol',
        'reportDate',
        'fiscalDateEnding',
      ]);
    }

    const deleted = refreshedRangeDeleted + (await this.deleteExpiredEarnings());

    return { fetched: validRows.length, updated: entities.length, deleted };
  }

  async getUsEarningsCalendar(options: {
    from: string;
    to: string;
    query?: string;
  }): Promise<UsEarningsCalendarEntity[]> {
    const queryBuilder = this.earningsRepository
      .createQueryBuilder('earnings')
      .where('earnings.report_date between :from and :to', {
        from: options.from,
        to: options.to,
      });

    const query = options.query?.trim();
    if (query) {
      queryBuilder.andWhere(
        '(earnings.symbol ilike :query or earnings.company_name ilike :query)',
        { query: `%${query}%` },
      );
    }

    return queryBuilder
      .orderBy('earnings.report_date', 'ASC')
      .addOrderBy('earnings.symbol', 'ASC')
      .limit(1000)
      .getMany();
  }

  async getUsEarningsBounds(): Promise<{
    minDate: string | null;
    maxDate: string | null;
  }> {
    const row = (await this.earningsRepository
      .createQueryBuilder('earnings')
      .select('min(earnings.report_date)', 'minDate')
      .addSelect('max(earnings.report_date)', 'maxDate')
      .getRawOne()) as { minDate?: string | null; maxDate?: string | null } | null;
    return {
      minDate: row?.minDate ?? null,
      maxDate: row?.maxDate ?? null,
    };
  }

  private async fetchAlphaVantageEarnings(
    apiKey: string,
  ): Promise<AlphaVantageEarningsRow[]> {
    const url = new URL('https://www.alphavantage.co/query');
    url.searchParams.set('function', 'EARNINGS_CALENDAR');
    url.searchParams.set('horizon', '3month');
    url.searchParams.set('apikey', apiKey);

    const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) {
      throw new Error(`Alpha Vantage earnings request failed: ${response.status}`);
    }

    const csv = await response.text();
    if (csv.trim().startsWith('{')) {
      throw new Error(`Alpha Vantage earnings response was not CSV: ${csv}`);
    }

    return this.parseCsv(csv);
  }

  private parseCsv(csv: string): AlphaVantageEarningsRow[] {
    const lines = csv.split(/\r?\n/).filter((line) => line.trim().length > 0);
    const [headerLine, ...dataLines] = lines;
    if (!headerLine) {
      return [];
    }

    const headers = this.parseCsvLine(headerLine);
    return dataLines.map((line) => {
      const values = this.parseCsvLine(line);
      const row = Object.fromEntries(
        headers.map((header, index) => [header, values[index] ?? '']),
      ) as Record<string, string>;
      return {
        symbol: row.symbol ?? '',
        name: row.name ?? '',
        reportDate: row.reportDate ?? '',
        fiscalDateEnding: row.fiscalDateEnding ?? '',
        estimate: row.estimate ?? '',
        currency: row.currency ?? '',
        timeOfTheDay: row.timeOfTheDay ?? '',
      };
    });
  }

  private parseCsvLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let quoted = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const next = line[index + 1];
      if (char === '"' && quoted && next === '"') {
        current += '"';
        index += 1;
        continue;
      }
      if (char === '"') {
        quoted = !quoted;
        continue;
      }
      if (char === ',' && !quoted) {
        values.push(current);
        current = '';
        continue;
      }
      current += char;
    }

    values.push(current);
    return values;
  }

  private async getUsStockMasterBySymbol(
    symbols: string[],
  ): Promise<Map<string, StockMasterEntity>> {
    const uniqueSymbols = [...new Set(symbols.map((symbol) => symbol.toUpperCase()))];
    const stockBySymbol = new Map<string, StockMasterEntity>();
    for (const batch of this.chunk(uniqueSymbols, 500)) {
      const stocks = await this.masterRepository
        .createQueryBuilder('stock')
        .where('stock.market = :market', { market: 'US' })
        .andWhere('stock.active = :active', { active: true })
        .andWhere('stock.symbol in (:...symbols)', { symbols: batch })
        .getMany();
      stocks.forEach((stock) => stockBySymbol.set(stock.symbol, stock));
    }
    return stockBySymbol;
  }

  private normalizeDate(value: string): string | null {
    const clean = value?.trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(clean) ? clean : null;
  }

  private async deleteExpiredEarnings(): Promise<number> {
    const retentionStart = this.getPreviousMonthStartDate();
    const result = await this.earningsRepository
      .createQueryBuilder()
      .delete()
      .where('report_date < :retentionStart', { retentionStart })
      .execute();
    return result.affected ?? 0;
  }

  private async deleteRefreshedEarningsRange(reportDates: string[]): Promise<number> {
    const validDates = reportDates.filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date));
    if (!validDates.length) {
      return 0;
    }
    const sortedDates = [...validDates].sort();
    const from = sortedDates[0];
    const to = sortedDates[sortedDates.length - 1];
    const result = await this.earningsRepository
      .createQueryBuilder()
      .delete()
      .where('report_date between :from and :to', { from, to })
      .execute();
    return result.affected ?? 0;
  }

  private getPreviousMonthStartDate(): string {
    const now = new Date();
    const date = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      '0',
    )}-01`;
  }

  private toNumber(value: string): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private chunk<T>(items: T[], size: number): T[][] {
    return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
      items.slice(index * size, index * size + size),
    );
  }

  private isScheduledJobsEnabled(): boolean {
    const explicit = this.configService.get<string>('ENABLE_SCHEDULED_JOBS');
    if (explicit !== undefined) {
      return explicit.toLowerCase() === 'true';
    }
    return this.configService.get<string>('NODE_ENV') === 'production';
  }
}
