import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsStockFinancialEntity } from './us-stock-financial.entity';

type PeriodType = 'ANNUAL' | 'QUARTERLY';

export type UsStockFinancialDto = {
  fiscalYear: number;
  fiscalQuarter: number;
  periodType: PeriodType;
  revenue: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  assets: number | null;
  liabilities: number | null;
  equity: number | null;
  eps: number | null;
  periodStart: string | null;
  periodEnd: string;
  filedAt: string | null;
  currency: string;
  source: string;
};

export type UsStockFinancialResponse = {
  symbol: string;
  companyName: string;
  isSp500: true;
  annual: UsStockFinancialDto[];
  quarterly: UsStockFinancialDto[];
};

type Sp500Company = { symbol: string; name: string; cik: string };
type SecUnit = {
  start?: string;
  end: string;
  val: number;
  accn?: string;
  fy?: number;
  fp?: string;
  form?: string;
  filed?: string;
};
type SecFact = { units?: Record<string, SecUnit[]> };
type SecCompanyFacts = { facts?: { 'us-gaap'?: Record<string, SecFact> } };
type PeriodKey = {
  periodType: PeriodType;
  fiscalYear: number;
  fiscalQuarter: number;
  start?: string;
  end: string;
  filed?: string;
  accn?: string;
};

const SP500_CSV_URL =
  'https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv';
const SEC_COMPANY_FACTS_URL = 'https://data.sec.gov/api/xbrl/companyfacts';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const TAGS = {
  revenue: [
    'RevenueFromContractWithCustomerExcludingAssessedTax',
    'Revenues',
    'SalesRevenueNet',
  ],
  operatingIncome: ['OperatingIncomeLoss'],
  netIncome: ['NetIncomeLoss', 'ProfitLoss'],
  assets: ['Assets'],
  liabilities: ['Liabilities'],
  equity: [
    'StockholdersEquity',
    'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest',
  ],
  eps: ['EarningsPerShareDiluted', 'EarningsPerShareBasicAndDiluted'],
} as const;

@Injectable()
export class UsStockFinancialsService {
  private readonly logger = new Logger(UsStockFinancialsService.name);
  private constituents:
    | { expiresAt: number; companies: Map<string, Sp500Company> }
    | undefined;
  private readonly inflight = new Map<
    string,
    Promise<UsStockFinancialResponse>
  >();

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(UsStockFinancialEntity)
    private readonly repository: Repository<UsStockFinancialEntity>,
  ) {}

  async getIfSp500(symbol: string): Promise<UsStockFinancialResponse | null> {
    const company = (await this.getConstituents()).get(
      this.normalizeSymbol(symbol),
    );
    return company ? this.getForCompany(company) : null;
  }

  async getRequired(symbol: string): Promise<UsStockFinancialResponse> {
    const result = await this.getIfSp500(symbol);
    if (!result) {
      throw new NotFoundException(
        'Financial statements are available for S&P 500 companies only.',
      );
    }
    return result;
  }

  private async getForCompany(
    company: Sp500Company,
  ): Promise<UsStockFinancialResponse> {
    const existing = this.inflight.get(company.symbol);
    if (existing) {
      return existing;
    }
    const request = this.loadOrFetch(company).finally(() =>
      this.inflight.delete(company.symbol),
    );
    this.inflight.set(company.symbol, request);
    return request;
  }

  private async loadOrFetch(
    company: Sp500Company,
  ): Promise<UsStockFinancialResponse> {
    let rows = await this.repository.find({
      where: { symbol: company.symbol },
      order: { fiscalYear: 'DESC', fiscalQuarter: 'DESC' },
    });
    const annualCount = rows.filter(
      (row) => row.periodType === 'ANNUAL',
    ).length;
    const quarterlyCount = rows.filter(
      (row) => row.periodType === 'QUARTERLY',
    ).length;
    if (annualCount < 5 || quarterlyCount < 8) {
      rows = await this.fetchAndStore(company);
    }
    return {
      symbol: company.symbol,
      companyName: company.name,
      isSp500: true,
      annual: rows
        .filter((row) => row.periodType === 'ANNUAL')
        .sort((a, b) => a.fiscalYear - b.fiscalYear)
        .slice(-5)
        .map((row) => this.toDto(row)),
      quarterly: rows
        .filter((row) => row.periodType === 'QUARTERLY')
        .sort(
          (a, b) =>
            a.fiscalYear - b.fiscalYear || a.fiscalQuarter - b.fiscalQuarter,
        )
        .slice(-12)
        .map((row) => this.toDto(row)),
    };
  }

  private async fetchAndStore(
    company: Sp500Company,
  ): Promise<UsStockFinancialEntity[]> {
    const response = await fetch(
      `${SEC_COMPANY_FACTS_URL}/CIK${company.cik.padStart(10, '0')}.json`,
      {
        headers: {
          'User-Agent':
            this.configService.get<string>('SEC_USER_AGENT')?.trim() ||
            '15F investment-community admin@15f.kro.kr',
          Accept: 'application/json',
        },
      },
    );
    if (!response.ok) {
      throw new ServiceUnavailableException(
        `SEC company facts request failed: ${response.status}`,
      );
    }
    const rows = this.parseFacts(
      company,
      (await response.json()) as SecCompanyFacts,
    );
    if (!rows.length) {
      this.logger.warn(`No usable SEC facts found for ${company.symbol}.`);
      throw new ServiceUnavailableException(
        'SEC financial statements are unavailable.',
      );
    }
    await this.repository.delete({ symbol: company.symbol });
    await this.repository.upsert(rows, ['id']);
    return this.repository.find({
      where: { symbol: company.symbol },
      order: { fiscalYear: 'DESC', fiscalQuarter: 'DESC' },
    });
  }

  private parseFacts(
    company: Sp500Company,
    body: SecCompanyFacts,
  ): Partial<UsStockFinancialEntity>[] {
    const facts = body.facts?.['us-gaap'] ?? {};
    const periods = [
      ...this.collectPeriods(facts, 'ANNUAL'),
      ...this.collectPeriods(facts, 'QUARTERLY'),
    ];
    const fetchedAt = new Date();
    const rows: Partial<UsStockFinancialEntity>[] = periods.map((period) => ({
      id: `${company.symbol}:${period.periodType}:${period.fiscalYear}:${period.fiscalQuarter}`,
      symbol: company.symbol,
      cik: company.cik,
      periodType: period.periodType,
      fiscalYear: period.fiscalYear,
      fiscalQuarter: period.fiscalQuarter,
      revenue: this.pickValue(facts, TAGS.revenue, period, false),
      operatingIncome: this.pickValue(
        facts,
        TAGS.operatingIncome,
        period,
        false,
      ),
      netIncome: this.pickValue(facts, TAGS.netIncome, period, false),
      assets: this.pickValue(facts, TAGS.assets, period, true),
      liabilities: this.pickValue(facts, TAGS.liabilities, period, true),
      equity: this.pickValue(facts, TAGS.equity, period, true),
      eps: this.pickValue(facts, TAGS.eps, period, false),
      periodStart: period.start ?? null,
      periodEnd: period.end,
      filedAt: period.filed ?? null,
      accessionNumber: period.accn ?? null,
      currency: 'USD',
      source: 'sec_companyfacts',
      fetchedAt,
    }));
    return [...rows, ...this.deriveQuarterFour(rows, fetchedAt)];
  }

  private deriveQuarterFour(
    rows: Partial<UsStockFinancialEntity>[],
    fetchedAt: Date,
  ): Partial<UsStockFinancialEntity>[] {
    const annualRows = rows.filter((row) => row.periodType === 'ANNUAL');
    const quarterlyRows = rows.filter((row) => row.periodType === 'QUARTERLY');
    const derived: Partial<UsStockFinancialEntity>[] = [];
    for (const annual of annualRows) {
      const year = annual.fiscalYear!;
      if (
        quarterlyRows.some(
          (row) => row.fiscalYear === year && row.fiscalQuarter === 4,
        )
      ) {
        continue;
      }
      const firstThree = quarterlyRows.filter(
        (row) =>
          row.fiscalYear === year &&
          row.fiscalQuarter !== undefined &&
          row.fiscalQuarter >= 1 &&
          row.fiscalQuarter <= 3,
      );
      if (firstThree.length !== 3) {
        continue;
      }
      const subtract = (
        key: 'revenue' | 'operatingIncome' | 'netIncome' | 'eps',
      ): number | null => {
        const annualValue = annual[key];
        const values = firstThree.map((row) => row[key]);
        return annualValue !== null &&
          annualValue !== undefined &&
          values.every((value) => value !== null && value !== undefined)
          ? annualValue -
              values.reduce<number>((sum, value) => sum + Number(value), 0)
          : null;
      };
      derived.push({
        id: [annual.symbol, 'QUARTERLY', year, 4].join(':'),
        symbol: annual.symbol,
        cik: annual.cik,
        periodType: 'QUARTERLY',
        fiscalYear: year,
        fiscalQuarter: 4,
        revenue: subtract('revenue'),
        operatingIncome: subtract('operatingIncome'),
        netIncome: subtract('netIncome'),
        assets: annual.assets ?? null,
        liabilities: annual.liabilities ?? null,
        equity: annual.equity ?? null,
        eps: null,
        periodStart: null,
        periodEnd: annual.periodEnd!,
        filedAt: annual.filedAt ?? null,
        accessionNumber: annual.accessionNumber ?? null,
        currency: 'USD',
        source: 'sec_companyfacts_derived_q4',
        fetchedAt,
      });
    }
    return derived;
  }

  private collectPeriods(
    facts: Record<string, SecFact>,
    periodType: PeriodType,
  ): PeriodKey[] {
    const candidates = this.getUnits(facts, TAGS.revenue, 'USD');
    const byKey = new Map<string, SecUnit>();
    for (const unit of candidates) {
      if (
        !unit.fy ||
        !unit.start ||
        !['10-K', '10-Q'].includes(unit.form ?? '')
      ) {
        continue;
      }
      const days = this.daysBetween(unit.start, unit.end);
      const isAnnual = unit.form === '10-K' && days >= 300 && days <= 400;
      const isQuarter =
        days >= 65 &&
        days <= 120 &&
        ((unit.form === '10-Q' && /^Q[1-3]$/.test(unit.fp ?? '')) ||
          unit.form === '10-K');
      if (
        (periodType === 'ANNUAL' && !isAnnual) ||
        (periodType === 'QUARTERLY' && !isQuarter)
      ) {
        continue;
      }
      const quarter =
        periodType === 'QUARTERLY'
          ? unit.form === '10-K'
            ? 4
            : Number((unit.fp ?? 'Q0').slice(1))
          : 0;
      const key = `${unit.end}:${quarter}`;
      const previous = byKey.get(key);
      if (!previous || (unit.filed ?? '') < (previous.filed ?? '')) {
        byKey.set(key, unit);
      }
    }
    return [...byKey.values()]
      .sort((a, b) => a.end.localeCompare(b.end))
      .slice(periodType === 'ANNUAL' ? -5 : -12)
      .map((unit) => ({
        periodType,
        fiscalYear: unit.fy!,

        fiscalQuarter:
          periodType === 'QUARTERLY'
            ? unit.form === '10-K'
              ? 4
              : Number((unit.fp ?? 'Q0').slice(1))
            : 0,
        start: unit.start,
        end: unit.end,
        filed: unit.filed,
        accn: unit.accn,
      }));
  }

  private pickValue(
    facts: Record<string, SecFact>,
    tags: readonly string[],
    period: PeriodKey,
    instant: boolean,
  ): number | null {
    const unitName = tags === TAGS.eps ? 'USD/shares' : 'USD';
    const matches = this.getUnits(facts, tags, unitName)
      .filter(
        (item) =>
          item.end === period.end &&
          Number.isFinite(item.val) &&
          (instant || !period.start || item.start === period.start),
      )
      .sort((a, b) => (b.filed ?? '').localeCompare(a.filed ?? ''));
    return matches[0]?.val ?? null;
  }

  private getUnits(
    facts: Record<string, SecFact>,
    tags: readonly string[],
    unitName: string,
  ): SecUnit[] {
    return tags.flatMap((tag) => facts[tag]?.units?.[unitName] ?? []);
  }

  private async getConstituents(): Promise<Map<string, Sp500Company>> {
    if (this.constituents && this.constituents.expiresAt > Date.now()) {
      return this.constituents.companies;
    }
    const response = await fetch(SP500_CSV_URL);
    if (!response.ok) {
      throw new ServiceUnavailableException(
        `S&P 500 constituent request failed: ${response.status}`,
      );
    }
    const companies = new Map<string, Sp500Company>();
    for (const line of (await response.text()).split(/\r?\n/).slice(1)) {
      const columns = this.parseCsvLine(line);
      const symbol = this.normalizeSymbol(columns[0] ?? '');
      const cik = (columns[6] ?? '').replace(/\D/g, '');
      if (symbol && cik) {
        companies.set(symbol, { symbol, name: columns[1], cik });
      }
    }
    if (companies.size < 450) {
      throw new ServiceUnavailableException(
        'S&P 500 constituent data is invalid.',
      );
    }
    this.constituents = { expiresAt: Date.now() + ONE_DAY_MS, companies };
    return companies;
  }

  private parseCsvLine(line: string): string[] {
    const values: string[] = [];
    let value = '';
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (character === '"' && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = !quoted;
      } else if (character === ',' && !quoted) {
        values.push(value);
        value = '';
      } else {
        value += character;
      }
    }
    values.push(value);
    return values;
  }

  private normalizeSymbol(symbol: string): string {
    return symbol.trim().toUpperCase().replace('.', '-');
  }

  private daysBetween(start: string, end: string): number {
    return Math.round(
      (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) /
        ONE_DAY_MS,
    );
  }

  private toDto(row: UsStockFinancialEntity): UsStockFinancialDto {
    return {
      fiscalYear: row.fiscalYear,
      fiscalQuarter: row.fiscalQuarter,
      periodType: row.periodType,
      revenue: row.revenue,
      operatingIncome: row.operatingIncome,
      netIncome: row.netIncome,
      assets: row.assets,
      liabilities: row.liabilities,
      equity: row.equity,
      eps: row.eps,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      filedAt: row.filedAt,
      currency: row.currency,
      source: row.source,
    };
  }
}
