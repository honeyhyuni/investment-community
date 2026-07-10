import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EconomicIndicatorEntity } from './economic-indicator.entity';

const SERIES = [
  { id: 'CPIAUCSL', name: 'Consumer Price Index', unit: 'index' },
  { id: 'PCEPI', name: 'PCE Price Index', unit: 'index' },
  { id: 'PCEPILFE', name: 'Core PCE Price Index', unit: 'index' },
  { id: 'PPIACO', name: 'Producer Price Index', unit: 'index' },
  { id: 'UNRATE', name: 'Unemployment Rate', unit: 'percent' },
  { id: 'PAYEMS', name: 'Nonfarm Payrolls', unit: 'thousands' },
  { id: 'GDPC1', name: 'Real GDP', unit: 'billions USD' },
  { id: 'FEDFUNDS', name: 'Federal Funds Rate', unit: 'percent' },
  { id: 'DGS10', name: '10-Year Treasury Rate', unit: 'percent' },
  { id: 'T10Y2Y', name: '10-Year Minus 2-Year Treasury Spread', unit: 'percent' },
  { id: 'M1SL', name: 'M1 Money Stock', unit: 'billions USD' },
  { id: 'M2SL', name: 'M2 Money Stock', unit: 'billions USD' },
  { id: 'BOGMBASE', name: 'Monetary Base', unit: 'millions USD' },
  { id: 'WALCL', name: 'Federal Reserve Total Assets', unit: 'millions USD' },
  { id: 'D2WLTGAL', name: 'Treasury General Account', unit: 'millions USD' },
] as const;

export type EconomicIndicatorListOptions = {
  limit?: number;
  seriesId?: string;
  start?: string;
  end?: string;
  latest?: boolean;
};

@Injectable()
export class EconomicIndicatorsService {
  private readonly logger = new Logger(EconomicIndicatorsService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(EconomicIndicatorEntity)
    private readonly indicators: Repository<EconomicIndicatorEntity>,
  ) {}

  async list(options: EconomicIndicatorListOptions = {}): Promise<EconomicIndicatorEntity[]> {
    const limit = Math.min(Math.max(options.limit ?? 5000, 1), 50000);
    const query = this.indicators.createQueryBuilder('indicator');

    if (options.seriesId) {
      query.andWhere('indicator.seriesId = :seriesId', { seriesId: options.seriesId });
    }
    if (options.start) {
      query.andWhere('indicator.observationDate >= :start', { start: options.start });
    }
    if (options.end) {
      query.andWhere('indicator.observationDate <= :end', { end: options.end });
    }

    if (options.latest) {
      return query
        .distinctOn(['indicator.seriesId'])
        .orderBy('indicator.seriesId', 'ASC')
        .addOrderBy('indicator.observationDate', 'DESC')
        .getMany();
    }

    return query
      .orderBy('indicator.observationDate', 'DESC')
      .addOrderBy('indicator.name', 'ASC')
      .take(limit)
      .getMany();
  }

  @Cron('0 15 7 * * 1-5', { timeZone: 'Asia/Seoul' })
  async refresh(): Promise<{ updated: number; skipped: boolean }> {
    const apiKey = this.config.get<string>('FRED_API_KEY')?.trim();
    if (!apiKey) return { updated: 0, skipped: true };
    let updated = 0;
    for (const series of SERIES) {
      const url = new URL('https://api.stlouisfed.org/fred/series/observations');
      url.searchParams.set('series_id', series.id);
      url.searchParams.set('api_key', apiKey);
      url.searchParams.set('file_type', 'json');
      url.searchParams.set('observation_start', '1990-01-01');
      url.searchParams.set('sort_order', 'asc');
      url.searchParams.set('limit', '100000');
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = await response.json() as { observations?: Array<{ date: string; value: string }> };
        const values = (body.observations ?? []).filter((row) => row.value !== '.' && Number.isFinite(Number(row.value)));
        if (!values.length) continue;
        const rows = values.map((value, index) => ({
          seriesId: series.id,
          name: series.name,
          country: 'US',
          observationDate: value.date,
          actual: value.value,
          previous: index > 0 ? values[index - 1].value : null,
          expected: null,
          unit: series.unit,
          importance: 'high',
          sourceUrl: `https://fred.stlouisfed.org/series/${series.id}`,
        }));
        await this.indicators.upsert(rows, ['seriesId', 'observationDate']);
        updated += rows.length;
      } catch (error) {
        this.logger.warn(`FRED ${series.id} refresh failed: ${error instanceof Error ? error.message : 'unknown'}`);
      }
    }
    return { updated, skipped: false };
  }
}
