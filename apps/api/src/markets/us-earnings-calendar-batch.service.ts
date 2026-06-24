import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { FavoriteStockEntity } from './favorite-stock.entity';
import { StockMasterEntity } from './stock-master.entity';
import { UsEarningsCalendarEntity } from './us-earnings-calendar.entity';
import { UsStockFinancialsService } from './us-stock-financials.service';

type AlphaVantageEarningsRow = {
  symbol: string;
  name: string;
  reportDate: string;
  fiscalDateEnding: string;
  estimate: string;
  currency: string;
  timeOfTheDay: string;
};

type FinnhubEarningsRow = {
  date?: string;
  epsActual?: number | null;
  epsEstimate?: number | null;
  hour?: string | null;
  quarter?: number | null;
  revenueActual?: number | null;
  revenueEstimate?: number | null;
  symbol?: string;
  year?: number | null;
};

type EarningsRefreshResult = {
  fetched: number;
  updated: number;
  deleted: number;
  finnhubFetched: number;
  finnhubUpdated: number;
  actualUpdated: number;
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
    @InjectRepository(FavoriteStockEntity)
    private readonly favoritesRepository: Repository<FavoriteStockEntity>,
    private readonly usStockFinancialsService: UsStockFinancialsService,
    private readonly notificationsService: NotificationsService,
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
        `US earnings calendar batch completed: fetched=${result.fetched}, updated=${result.updated}, finnhubUpdated=${result.finnhubUpdated}, actualUpdated=${result.actualUpdated}.`,
      );
    } catch (error) {
      this.logger.warn(
        `US earnings calendar batch failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  @Cron('0 */15 * * * *', { timeZone: 'Asia/Seoul' })
  async refreshDueActuals(): Promise<void> {
    if (!this.isScheduledJobsEnabled()) {
      return;
    }

    try {
      const result = await this.refreshDueFinnhubActuals();
      if (result.checkedDates.length || result.actualUpdated) {
        this.logger.log(
          `US earnings actual check completed: dates=${result.checkedDates.join(',') || '-'}, updated=${result.actualUpdated}.`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `US earnings actual check failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  @Cron('0 0 4 * * *', { timeZone: 'Asia/Seoul' })
  async refreshDailySecConfirmations(): Promise<void> {
    if (!this.isScheduledJobsEnabled()) {
      return;
    }

    try {
      const result = await this.refreshSecConfirmations();
      this.logger.log(
        `US earnings SEC confirmation completed: checked=${result.checked}, confirmed=${result.confirmed}.`,
      );
    } catch (error) {
      this.logger.warn(
        `US earnings SEC confirmation failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  async refreshUsEarningsCalendar(): Promise<EarningsRefreshResult> {
    const alpha = await this.refreshAlphaVantageCalendar();
    const finnhub = await this.augmentFinnhubEarnings();
    return {
      ...alpha,
      finnhubFetched: finnhub.fetched,
      finnhubUpdated: finnhub.updated,
      actualUpdated: finnhub.actualUpdated,
    };
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

  async getUsEarningsForSymbol(
    symbol: string,
  ): Promise<UsEarningsCalendarEntity[]> {
    const normalized = symbol.trim().toUpperCase();
    if (!(await this.usStockFinancialsService.isSp500(normalized))) {
      return [];
    }

    const rows = await this.earningsRepository
      .createQueryBuilder('earnings')
      .where('earnings.symbol = :symbol', { symbol: normalized })
      .andWhere('earnings.report_date >= :from', {
        from: this.formatDateOffset(-45),
      })
      .orderBy('earnings.report_date', 'DESC')
      .addOrderBy('earnings.updated_at', 'DESC')
      .limit(8)
      .getMany();

    return this.attachSecConfirmation(normalized, rows);
  }

  private async attachSecConfirmation(
    symbol: string,
    rows: UsEarningsCalendarEntity[],
  ): Promise<UsEarningsCalendarEntity[]> {
    if (!rows.length) {
      return rows;
    }

    const financials = await this.usStockFinancialsService
      .getIfSp500(symbol)
      .catch(() => null);
    if (!financials) {
      return rows;
    }

    const confirmedByLabel = new Map(
      financials.quarterly.map((row) => [this.financialPeriodLabel(row), row]),
    );

    return rows.map((row) => {
      const label = this.earningsPeriodLabel(row);
      const confirmed = label ? confirmedByLabel.get(label) : undefined;
      if (!confirmed) {
        return row;
      }
      row.secConfirmedAt = confirmed.filedAt
        ? new Date(confirmed.filedAt)
        : row.secConfirmedAt;
      row.secFinancialId = [
        symbol,
        'QUARTERLY',
        confirmed.fiscalYear,
        confirmed.fiscalQuarter,
      ].join(':');
      return row;
    });
  }

  private earningsPeriodLabel(row: UsEarningsCalendarEntity): string | null {
    if (row.finnhubYear && row.finnhubQuarter) {
      return row.finnhubYear + ' Q' + row.finnhubQuarter;
    }
    if (!row.fiscalDateEnding) {
      return null;
    }
    const date = new Date(row.fiscalDateEnding + 'T00:00:00Z');
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return (
      date.getUTCFullYear() + ' Q' + (Math.floor(date.getUTCMonth() / 3) + 1)
    );
  }

  private financialPeriodLabel(row: {
    fiscalYear: number;
    fiscalQuarter: number;
    periodStart: string | null;
    periodEnd: string;
  }): string {
    const end = new Date(row.periodEnd.slice(0, 10) + 'T00:00:00Z');
    const start = row.periodStart
      ? new Date(row.periodStart.slice(0, 10) + 'T00:00:00Z')
      : null;
    const middle =
      start && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())
        ? new Date((start.getTime() + end.getTime()) / 2)
        : end;
    if (Number.isNaN(middle.getTime())) {
      return row.fiscalYear + ' Q' + row.fiscalQuarter;
    }
    return (
      middle.getUTCFullYear() +
      ' Q' +
      (Math.floor(middle.getUTCMonth() / 3) + 1)
    );
  }

  async getUsEarningsBounds(): Promise<{
    minDate: string | null;
    maxDate: string | null;
  }> {
    const row = (await this.earningsRepository
      .createQueryBuilder('earnings')
      .select('min(earnings.report_date)', 'minDate')
      .addSelect('max(earnings.report_date)', 'maxDate')
      .getRawOne()) as {
      minDate?: string | null;
      maxDate?: string | null;
    } | null;
    return {
      minDate: row?.minDate ?? null,
      maxDate: row?.maxDate ?? null,
    };
  }

  private async refreshAlphaVantageCalendar(): Promise<{
    fetched: number;
    updated: number;
    deleted: number;
  }> {
    const apiKey = this.configService
      .get<string>('ALPHA_VANTAGE_API_KEY')
      ?.trim();
    if (!apiKey) {
      this.logger.warn(
        'US earnings calendar Alpha Vantage step skipped: ALPHA_VANTAGE_API_KEY is missing.',
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
      const estimate = this.toNumber(row.estimate);
      return {
        symbol,
        companyName: row.name?.trim() || stock?.name || symbol,
        reportDate: row.reportDate,
        fiscalDateEnding: this.normalizeDate(row.fiscalDateEnding),
        estimate,
        estimateSource: estimate !== null ? 'alpha_vantage' : null,
        currency: row.currency?.trim() || null,
        timeOfTheDay: row.timeOfTheDay?.trim() || null,
        stockMasterId: stock?.id ?? null,
        source: 'alpha_vantage',
        raw: row,
      };
    });

    for (const batch of this.chunk(entities, 500)) {
      await this.earningsRepository.upsert(batch, [
        'symbol',
        'reportDate',
        'fiscalDateEnding',
      ]);
    }

    const deleted = await this.deleteExpiredEarnings();

    return { fetched: validRows.length, updated: entities.length, deleted };
  }

  private async augmentFinnhubEarnings(): Promise<{
    fetched: number;
    updated: number;
    actualUpdated: number;
  }> {
    const token = this.configService.get<string>('FINNHUB_API_KEY')?.trim();
    if (!token) {
      this.logger.warn(
        'US earnings calendar Finnhub step skipped: FINNHUB_API_KEY is missing.',
      );
      return { fetched: 0, updated: 0, actualUpdated: 0 };
    }

    const rows: FinnhubEarningsRow[] = [];
    for (let startOffset = -7; startOffset <= 60; startOffset += 7) {
      const endOffset = Math.min(startOffset + 6, 60);
      rows.push(
        ...(await this.fetchFinnhubEarnings(
          token,
          this.formatDateOffset(startOffset),
          this.formatDateOffset(endOffset),
        )),
      );
    }
    const sp500Symbols = await this.usStockFinancialsService.getSp500Symbols();
    const validRows = rows.filter((row) => {
      const symbol = row.symbol?.trim().toUpperCase();
      return symbol && row.date && sp500Symbols.has(symbol);
    });
    return this.applyFinnhubRows(validRows);
  }

  async refreshDueFinnhubActuals(): Promise<{
    checkedDates: string[];
    fetched: number;
    updated: number;
    actualUpdated: number;
  }> {
    const token = this.configService.get<string>('FINNHUB_API_KEY')?.trim();
    if (!token) {
      return { checkedDates: [], fetched: 0, updated: 0, actualUpdated: 0 };
    }

    const due = this.getDueActualCheckWindows();
    if (!due.length) {
      return { checkedDates: [], fetched: 0, updated: 0, actualUpdated: 0 };
    }

    const sp500Symbols = await this.usStockFinancialsService.getSp500Symbols();
    const checkedDates: string[] = [];
    let fetched = 0;
    let updated = 0;
    let actualUpdated = 0;

    for (const window of due) {
      const candidates = await this.findActualCandidates(
        window.reportDate,
        window.hours,
      );
      if (!candidates.length) {
        continue;
      }
      const rows = await this.fetchFinnhubEarnings(
        token,
        window.reportDate,
        window.reportDate,
      );
      const candidateSymbols = new Set(candidates.map((row) => row.symbol));
      const validRows = rows.filter((row) => {
        const symbol = row.symbol?.trim().toUpperCase();
        return (
          symbol &&
          row.date &&
          candidateSymbols.has(symbol) &&
          sp500Symbols.has(symbol)
        );
      });
      const result = await this.applyFinnhubRows(validRows);
      checkedDates.push(window.reportDate);
      fetched += result.fetched;
      updated += result.updated;
      actualUpdated += result.actualUpdated;
    }

    return { checkedDates, fetched, updated, actualUpdated };
  }

  async refreshSecConfirmations(): Promise<{
    checked: number;
    confirmed: number;
  }> {
    const rows = await this.earningsRepository
      .createQueryBuilder('earnings')
      .where('earnings.report_date between :from and :to', {
        from: this.formatDateOffset(-30),
        to: this.formatDateOffset(-1),
      })
      .andWhere('earnings.sec_confirmed_at is null')
      .andWhere(
        '(earnings.eps_actual is not null or earnings.revenue_actual is not null)',
      )
      .orderBy('earnings.report_date', 'DESC')
      .limit(100)
      .getMany();

    let checked = 0;
    let confirmed = 0;
    for (const row of rows) {
      if (!(await this.usStockFinancialsService.isSp500(row.symbol))) {
        continue;
      }
      checked += 1;
      const financials = await this.usStockFinancialsService
        .refreshIfSp500(row.symbol)
        .catch(() => null);
      if (!financials) {
        continue;
      }
      const label = this.earningsPeriodLabel(row);
      const secRow = label
        ? financials.quarterly.find(
            (financial) => this.financialPeriodLabel(financial) === label,
          )
        : undefined;
      if (!secRow) {
        continue;
      }
      row.secConfirmedAt = secRow.filedAt
        ? new Date(secRow.filedAt)
        : new Date();
      row.secFinancialId = [
        row.symbol,
        'QUARTERLY',
        secRow.fiscalYear,
        secRow.fiscalQuarter,
      ].join(':');
      await this.earningsRepository.save(row);
      confirmed += 1;
    }
    return { checked, confirmed };
  }

  private async applyFinnhubRows(validRows: FinnhubEarningsRow[]): Promise<{
    fetched: number;
    updated: number;
    actualUpdated: number;
  }> {
    const stockBySymbol = await this.getUsStockMasterBySymbol(
      validRows.map((row) => row.symbol ?? ''),
    );
    let updated = 0;
    let actualUpdated = 0;

    for (const row of validRows) {
      const symbol = row.symbol!.trim().toUpperCase();
      const reportDate = row.date!.slice(0, 10);
      const nearby = await this.earningsRepository
        .createQueryBuilder('earnings')
        .where('earnings.symbol = :symbol', { symbol })
        .andWhere('earnings.report_date between :from and :to', {
          from: this.shiftDate(reportDate, -1),
          to: this.shiftDate(reportDate, 1),
        })
        .orderBy(
          "case when earnings.source = 'alpha_vantage' then 0 else 1 end",
          'ASC',
        )
        .addOrderBy('earnings.updated_at', 'DESC')
        .getMany();
      const existing = nearby[0] ?? null;
      const hasActual =
        this.toOptionalNumber(row.epsActual) !== null ||
        this.toOptionalNumber(row.revenueActual) !== null;
      const stock = stockBySymbol.get(symbol);
      const entity =
        existing ??
        this.earningsRepository.create({
          symbol,
          companyName: stock?.name || symbol,
          reportDate,
          fiscalDateEnding: null,
          stockMasterId: stock?.id ?? null,
          source: 'finnhub',
        });

      const epsEstimate = this.toOptionalNumber(row.epsEstimate);
      const revenueEstimate = this.toOptionalNumber(row.revenueEstimate);
      const epsActual = this.toOptionalNumber(row.epsActual);
      const revenueActual = this.toOptionalNumber(row.revenueActual);
      const wasActualMissing =
        entity.epsActual === null && entity.revenueActual === null;

      entity.estimate = entity.estimate ?? epsEstimate;
      entity.revenueEstimate =
        revenueEstimate ?? entity.revenueEstimate ?? null;
      entity.epsActual = epsActual ?? entity.epsActual ?? null;
      entity.revenueActual = revenueActual ?? entity.revenueActual ?? null;
      entity.actualCheckedAt = hasActual
        ? new Date()
        : (entity.actualCheckedAt ?? null);
      entity.estimateSource =
        entity.estimateSource ??
        (epsEstimate !== null || revenueEstimate !== null ? 'finnhub' : null);
      entity.actualSource = hasActual
        ? 'finnhub'
        : (entity.actualSource ?? null);
      entity.finnhubYear =
        this.toOptionalInteger(row.year) ?? entity.finnhubYear ?? null;
      entity.finnhubQuarter =
        this.toOptionalInteger(row.quarter) ?? entity.finnhubQuarter ?? null;
      entity.currency = entity.currency ?? 'USD';
      entity.timeOfTheDay = row.hour?.trim() || entity.timeOfTheDay || null;
      entity.raw = { ...(entity.raw ?? {}), finnhub: row };

      const saved = await this.earningsRepository.save(entity);
      const duplicateIds = nearby
        .filter((candidate) => candidate.id !== saved.id)
        .map((candidate) => candidate.id);
      if (duplicateIds.length) {
        await this.earningsRepository.delete(duplicateIds);
      }
      updated += 1;
      if (hasActual && wasActualMissing) {
        actualUpdated += 1;
        await this.sendActualReadyNotification(saved).catch((error) => {
          this.logger.warn(
            'US earnings actual notification failed for ' +
              saved.symbol +
              ': ' +
              (error instanceof Error ? error.message : 'unknown error'),
          );
        });
      }
    }

    return { fetched: validRows.length, updated, actualUpdated };
  }

  private async sendActualReadyNotification(
    item: UsEarningsCalendarEntity,
  ): Promise<void> {
    const audience = await this.favoritesRepository.find({
      where: { market: 'US', symbol: item.symbol },
      select: { userId: true },
    });
    if (!audience.length) {
      return;
    }

    const epsText =
      item.epsActual !== null
        ? 'EPS ' +
          item.epsActual.toFixed(2) +
          (item.currency ? ' ' + item.currency : '')
        : null;
    const revenueText =
      item.revenueActual !== null
        ? '\uB9E4\uCD9C ' + this.formatActualRevenue(item.revenueActual)
        : null;
    const body =
      [epsText, revenueText].filter(Boolean).join(', ') ||
      '\uBC1C\uD45C\uCE58\uAC00 \uC5C5\uB370\uC774\uD2B8\uB418\uC5C8\uC2B5\uB2C8\uB2E4.';

    await this.notificationsService.sendToUsers(
      audience.map((row) => row.userId),
      {
        type: 'EARNINGS',
        title: item.symbol + ' \uC2E4\uC801 \uBCF4\uAE30',
        body,
        url: '/stocks/US/' + encodeURIComponent(item.symbol) + '/earnings',
        data: {
          earningsId: item.id,
          symbol: item.symbol,
          reportDate: item.reportDate,
          kind: 'actual-ready',
        },
        tag: 'earnings-actual:' + item.symbol,
      },
      (userId) =>
        'earnings-actual:v1:' + userId + ':' + item.id + ':' + item.reportDate,
    );
  }

  private formatActualRevenue(value: number): string {
    const abs = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    if (abs >= 1_000_000_000_000) {
      return sign + (abs / 1_000_000_000_000).toFixed(2) + 'T USD';
    }
    if (abs >= 1_000_000_000) {
      return sign + (abs / 1_000_000_000).toFixed(2) + 'B USD';
    }
    if (abs >= 1_000_000) {
      return sign + (abs / 1_000_000).toFixed(2) + 'M USD';
    }
    return sign + abs.toLocaleString('en-US') + ' USD';
  }

  private getDueActualCheckWindows(): Array<{
    reportDate: string;
    hours: Array<'amc' | 'bmo' | 'unknown'>;
  }> {
    const now = this.getKstNow();
    const windows: Array<{
      reportDate: string;
      hours: Array<'amc' | 'bmo' | 'unknown'>;
    }> = [];

    if (now.hour >= 6 && now.hour < 10) {
      windows.push({
        reportDate: this.formatDateFromParts(now.year, now.month, now.day, -1),
        hours: ['amc', 'unknown'],
      });
    }

    if (
      now.hour >= 20 &&
      (now.hour < 23 || (now.hour === 23 && now.minute <= 30))
    ) {
      windows.push({
        reportDate: this.formatDateFromParts(now.year, now.month, now.day, 0),
        hours: ['bmo', 'unknown'],
      });
    }

    return windows;
  }

  private async findActualCandidates(
    reportDate: string,
    hours: Array<'amc' | 'bmo' | 'unknown'>,
  ): Promise<UsEarningsCalendarEntity[]> {
    const rows = await this.earningsRepository
      .createQueryBuilder('earnings')
      .where('earnings.report_date = :reportDate', { reportDate })
      .andWhere(
        '(earnings.eps_actual is null and earnings.revenue_actual is null)',
      )
      .getMany();

    const sp500Symbols = await this.usStockFinancialsService.getSp500Symbols();
    return rows.filter(
      (row) =>
        sp500Symbols.has(row.symbol) &&
        hours.includes(this.normalizeFinnhubHour(row.timeOfTheDay)),
    );
  }

  private normalizeFinnhubHour(
    value: string | null,
  ): 'amc' | 'bmo' | 'unknown' {
    const normalized = value?.trim().toLowerCase();
    if (
      normalized === 'amc' ||
      normalized === 'post-market' ||
      normalized === 'postmarket' ||
      normalized === 'after-market' ||
      normalized === 'after hours'
    ) {
      return 'amc';
    }
    if (
      normalized === 'bmo' ||
      normalized === 'pre-market' ||
      normalized === 'premarket' ||
      normalized === 'before-market' ||
      normalized === 'before market'
    ) {
      return 'bmo';
    }
    return 'unknown';
  }

  private getKstNow(): {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
  } {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date());
    const value = (type: string) =>
      Number(parts.find((part) => part.type === type)?.value ?? 0);
    return {
      year: value('year'),
      month: value('month'),
      day: value('day'),
      hour: value('hour'),
      minute: value('minute'),
    };
  }

  private shiftDate(value: string, offsetDays: number): string {
    const date = new Date(value.slice(0, 10) + 'T00:00:00Z');
    date.setUTCDate(date.getUTCDate() + offsetDays);
    return (
      date.getUTCFullYear() +
      '-' +
      String(date.getUTCMonth() + 1).padStart(2, '0') +
      '-' +
      String(date.getUTCDate()).padStart(2, '0')
    );
  }

  private formatDateFromParts(
    year: number,
    month: number,
    day: number,
    offsetDays: number,
  ): string {
    const date = new Date(Date.UTC(year, month - 1, day + offsetDays));
    return (
      date.getUTCFullYear() +
      '-' +
      String(date.getUTCMonth() + 1).padStart(2, '0') +
      '-' +
      String(date.getUTCDate()).padStart(2, '0')
    );
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
      throw new Error(
        `Alpha Vantage earnings request failed: ${response.status}`,
      );
    }

    const csv = await response.text();
    if (csv.trim().startsWith('{')) {
      throw new Error(`Alpha Vantage earnings response was not CSV: ${csv}`);
    }

    return this.parseCsv(csv);
  }

  private async fetchFinnhubEarnings(
    token: string,
    from: string,
    to: string,
  ): Promise<FinnhubEarningsRow[]> {
    const url = new URL('https://finnhub.io/api/v1/calendar/earnings');
    url.searchParams.set('from', from);
    url.searchParams.set('to', to);
    url.searchParams.set('token', token);

    const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) {
      throw new Error(`Finnhub earnings request failed: ${response.status}`);
    }

    const body = (await response.json()) as {
      earningsCalendar?: FinnhubEarningsRow[];
    };
    return Array.isArray(body.earningsCalendar) ? body.earningsCalendar : [];
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
    const uniqueSymbols = [
      ...new Set(symbols.map((symbol) => symbol.toUpperCase()).filter(Boolean)),
    ];
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

  private async deleteRefreshedEarningsRange(
    reportDates: string[],
  ): Promise<number> {
    const validDates = reportDates.filter((date) =>
      /^\d{4}-\d{2}-\d{2}$/.test(date),
    );
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

  private formatDateOffset(offsetDays: number): string {
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      '0',
    )}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private toNumber(value: string): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private toOptionalNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private toOptionalInteger(value: unknown): number | null {
    const parsed = this.toOptionalNumber(value);
    return parsed === null ? null : Math.trunc(parsed);
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
