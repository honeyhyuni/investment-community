import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { In, Repository } from 'typeorm';
import { GuruHoldingEntity } from './guru-holding.entity';
import { GuruManagerEntity } from './guru-manager.entity';
import { StockMasterEntity } from './stock-master.entity';
import { StockProfileEntity } from './stock-profile.entity';
import { GuruSecurityMasterEntity } from './guru-security-master.entity';

type SeedHolding = {
  issuer: string;
  classTitle: string;
  cusip: string;
  figi: string | null;
  value: number;
  shares: number;
  shareType?: string;
  putCall?: string | null;
};

type SeedQuarter = {
  accession: string;
  cik: string;
  filingDate: string;
  reportDate: string;
  holdings: SeedHolding[];
};

type GuruSeed = {
  generatedAt: string;
  source: string;
  managers: Array<{
    slug: string;
    personName: string;
    firmName: string;
    cik: string;
    sortOrder: number;
  }>;
  quarters: {
    current: Record<string, SeedQuarter | undefined>;
    previous: Record<string, SeedQuarter | undefined>;
  };
};

type NasdaqScreenerRow = {
  symbol?: string;
  name?: string;
  sector?: string;
  industry?: string;
  lastsale?: string;
};

export type GuruHoldingResponse = {
  id: string;
  ticker: string | null;
  issuerName: string;
  cusip: string;
  putCall: string | null;
  value: number;
  shares: number;
  weight: number;
  previousWeight: number;
  weightChange: number;
  shareChange: number;
  returnPercent: number | null;
  industry: string | null;
  sector: string;
};

export type GuruSummaryResponse = {
  slug: string;
  personName: string;
  firmName: string;
  reportDate: string | null;
  filingDate: string | null;
  totalValue: number;
  positionCount: number;
  topHolding: GuruHoldingResponse | null;
};

export type GuruDetailResponse = GuruSummaryResponse & {
  topBuys: GuruHoldingResponse[];
  topSells: GuruHoldingResponse[];
  holdings: GuruHoldingResponse[];
  dataSource: string;
  returnAsOf: string | null;
  stats: {
    totalPositions: number;
    top10Weight: number;
    estimatedTurnover: number;
    newBuys: number;
    soldOut: number;
    increased: number;
    reduced: number;
  };
};

@Injectable()
export class GuruPortfoliosService implements OnModuleInit {
  private readonly logger = new Logger(GuruPortfoliosService.name);

  constructor(
    @InjectRepository(GuruManagerEntity)
    private readonly managerRepository: Repository<GuruManagerEntity>,
    @InjectRepository(GuruHoldingEntity)
    private readonly holdingRepository: Repository<GuruHoldingEntity>,
    @InjectRepository(StockMasterEntity)
    private readonly stockRepository: Repository<StockMasterEntity>,
    @InjectRepository(StockProfileEntity)
    private readonly profileRepository: Repository<StockProfileEntity>,
    @InjectRepository(GuruSecurityMasterEntity)
    private readonly securityMasterRepository: Repository<GuruSecurityMasterEntity>,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.configService.get<string>('NODE_ENV') === 'production') {
      return;
    }

    const result = await this.refreshFromOfficialSeed();
    this.logger.log(
      `Development guru seed loaded: managers=${result.managers}, holdings=${result.holdings}.`,
    );
  }

  @Cron('0 10 6 * 2,5,8,11 *', { timeZone: 'Asia/Seoul' })
  async runScheduledQuarterlyGuruBatch(): Promise<void> {
    if (!this.isScheduledJobsEnabled()) {
      this.logger.log('Scheduled guru 13F batch disabled.');
      return;
    }
    const result = await this.refreshFromOfficialSeed();
    this.logger.log(
      `Scheduled guru 13F batch completed: managers=${result.managers}, holdings=${result.holdings}, generatedAt=${result.generatedAt}.`,
    );
  }

  @Cron('0 30 4 * * 0', { timeZone: 'Asia/Seoul' })
  async runScheduledWeeklyNasdaqGuruBatch(): Promise<void> {
    if (!this.isScheduledJobsEnabled()) {
      this.logger.log('Scheduled guru Nasdaq classification batch disabled.');
      return;
    }
    const result = await this.refreshNasdaqClassifications();
    this.logger.log(
      `Scheduled guru Nasdaq classification batch completed: scanned=${result.scanned}, updated=${result.updated}, failed=${result.failed}.`,
    );
  }

  async refreshOperationalBatch(force = false): Promise<{
    managers: number;
    holdings: number;
    skippedManagers: number;
    generatedAt: string;
    nasdaq: { scanned: number; updated: number; failed: number };
  }> {
    const guru = await this.refreshFromOfficialSeed({ force });
    const nasdaq = await this.refreshNasdaqClassifications();
    return { ...guru, nasdaq };
  }

  async getManagers(): Promise<GuruSummaryResponse[]> {
    const managers = await this.managerRepository.find({
      where: { enabled: true },
      order: { sortOrder: 'ASC' },
    });
    const managerIds = managers.map((manager) => manager.id);
    const holdings = managerIds.length
      ? await this.holdingRepository.find({
          where: { managerId: In(managerIds) },
          order: { weight: 'DESC' },
        })
      : [];
    const firstByManager = new Map<string, GuruHoldingEntity>();
    for (const holding of holdings) {
      if (!firstByManager.has(holding.managerId)) {
        firstByManager.set(holding.managerId, holding);
      }
    }

    return managers.map((manager) =>
      this.toSummary(manager, firstByManager.get(manager.id) ?? null),
    );
  }

  async getManager(slug: string): Promise<GuruDetailResponse> {
    const manager = await this.managerRepository.findOne({ where: { slug } });
    if (!manager) {
      throw new NotFoundException('Guru portfolio was not found.');
    }

    const holdings = await this.holdingRepository.find({
      where: { managerId: manager.id },
      order: { weight: 'DESC' },
    });
    const tickers = holdings
      .map((holding) => holding.ticker)
      .filter((ticker): ticker is string => Boolean(ticker));
    const sectorData = await this.buildSectorMap(tickers);
    const mapped = holdings.map((holding) =>
      this.toHolding(holding, sectorData.map.get(holding.ticker ?? '') ?? null),
    );
    return {
      ...this.toSummary(manager, holdings[0] ?? null),
      topBuys: [...mapped]
        .filter((holding) => holding.shareChange > 0)
        .sort((a, b) => b.weightChange - a.weightChange)
        .slice(0, 5),
      topSells: [...mapped]
        .filter((holding) => holding.shareChange < 0)
        .sort((a, b) => a.weightChange - b.weightChange)
        .slice(0, 5),
      holdings: mapped.filter((holding) => holding.weight > 0),
      dataSource: 'SEC Form 13F',
      returnAsOf: sectorData.generatedAt,
      stats: {
        totalPositions: mapped.filter((holding) => holding.weight > 0).length,
        top10Weight: [...mapped]
          .filter((holding) => holding.weight > 0)
          .sort((a, b) => b.weight - a.weight)
          .slice(0, 10)
          .reduce((sum, holding) => sum + holding.weight, 0),
        estimatedTurnover: Math.min(
          100,
          mapped.reduce(
            (sum, holding) => sum + Math.abs(holding.weightChange),
            0,
          ) / 2,
        ),
        newBuys: mapped.filter(
          (holding) => holding.previousWeight <= 0 && holding.weight > 0,
        ).length,
        soldOut: mapped.filter(
          (holding) => holding.previousWeight > 0 && holding.weight <= 0,
        ).length,
        increased: mapped.filter(
          (holding) =>
            holding.previousWeight > 0 &&
            holding.weight > 0 &&
            holding.shareChange > 0,
        ).length,
        reduced: mapped.filter(
          (holding) =>
            holding.previousWeight > 0 &&
            holding.weight > 0 &&
            holding.shareChange < 0,
        ).length,
      },
    };
  }

  async refreshFromOfficialSeed(options: { force?: boolean } = {}): Promise<{
    managers: number;
    holdings: number;
    skippedManagers: number;
    generatedAt: string;
  }> {
    const seed = this.readSeed();
    const tickerMap = await this.buildTickerMap();
    const cusipTickerMap = new Map(
      (await this.securityMasterRepository.find()).flatMap((security) =>
        security.ticker ? [[security.cusip, security.ticker] as const] : [],
      ),
    );
    let holdingCount = 0;
    let skippedManagers = 0;

    for (const definition of seed.managers) {
      const current = seed.quarters.current[definition.cik];
      const previous = seed.quarters.previous[definition.cik];
      const currentHoldings = this.aggregateHoldings(current?.holdings ?? []);
      const previousHoldings = this.aggregateHoldings(previous?.holdings ?? []);
      const totalValue = currentHoldings.reduce(
        (sum, holding) => sum + holding.value,
        0,
      );
      const previousTotal = previousHoldings.reduce(
        (sum, holding) => sum + holding.value,
        0,
      );
      const managerId = this.stableId(`manager:${definition.slug}`);
      const seedAccession = current?.accession ?? null;
      const existingManager = await this.managerRepository.findOne({
        where: { id: managerId },
      });
      const shouldSkipHoldings =
        !options.force &&
        Boolean(seedAccession) &&
        existingManager?.accessionNumber === seedAccession;
      const manager = this.managerRepository.create({
        id: managerId,
        ...definition,
        reportDate: current?.reportDate ?? null,
        filingDate: current?.filingDate ?? null,
        accessionNumber: seedAccession,
        totalValue,
        positionCount: currentHoldings.length,
        enabled: true,
      });
      await this.managerRepository.save(manager);
      if (shouldSkipHoldings) {
        skippedManagers += 1;
        continue;
      }
      await this.holdingRepository.delete({ managerId });

      const previousByPosition = new Map(
        previousHoldings.map((holding) => [this.positionKey(holding), holding]),
      );
      const currentPositions = new Set(
        currentHoldings.map((holding) => this.positionKey(holding)),
      );
      const comparableHoldings = [
        ...currentHoldings,
        ...previousHoldings
          .filter((holding) => !currentPositions.has(this.positionKey(holding)))
          .map((holding) => ({ ...holding, value: 0, shares: 0 })),
      ];
      const entities = comparableHoldings.map((holding) => {
        const positionKey = this.positionKey(holding);
        const old = previousByPosition.get(positionKey);
        const weight = totalValue ? (holding.value / totalValue) * 100 : 0;
        const previousWeight =
          old && previousTotal ? (old.value / previousTotal) * 100 : 0;
        const currentUnitPrice =
          holding.shares > 0 ? holding.value / holding.shares : null;
        const previousUnitPrice =
          old && old.shares > 0 ? old.value / old.shares : null;
        const returnPercent =
          currentUnitPrice !== null &&
          previousUnitPrice !== null &&
          previousUnitPrice !== 0
            ? ((currentUnitPrice / previousUnitPrice) - 1) * 100
            : null;

        return this.holdingRepository.create({
          id: this.stableId(`${managerId}:${positionKey}`),
          managerId,
          cusip: holding.cusip,
          figi: holding.figi,
          ticker: this.findTicker(
            holding.cusip,
            holding.issuer,
            holding.classTitle,
            tickerMap,
            cusipTickerMap,
          ),
          putCall: holding.putCall ?? null,
          issuerName: holding.issuer,
          classTitle: holding.classTitle,
          value: holding.value,
          shares: holding.shares,
          weight,
          previousValue: old?.value ?? 0,
          previousShares: old?.shares ?? 0,
          previousWeight,
          weightChange: weight - previousWeight,
          shareChange: holding.shares - (old?.shares ?? 0),
          returnPercent,
        });
      });
      for (let index = 0; index < entities.length; index += 500) {
        await this.holdingRepository.save(entities.slice(index, index + 500));
      }
      holdingCount += entities.length;
    }

    return {
      managers: seed.managers.length,
      holdings: holdingCount,
      skippedManagers,
      generatedAt: seed.generatedAt,
    };
  }

  async refreshNasdaqClassifications(): Promise<{
    scanned: number;
    updated: number;
    failed: number;
  }> {
    let rows: NasdaqScreenerRow[];
    try {
      rows = await this.fetchNasdaqRows();
    } catch (error) {
      this.logger.warn(
        `Failed to fetch Nasdaq screener rows for guru classifications: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return { scanned: 0, updated: 0, failed: 1 };
    }
    const bySymbol = new Map(
      rows
        .filter((row) => row.symbol)
        .map((row) => [String(row.symbol).toUpperCase(), row] as const),
    );
    const mastered = await this.securityMasterRepository.find();
    let scanned = 0;
    let updated = 0;
    let failed = 0;
    const now = new Date();

    for (const security of mastered) {
      if (!security.ticker) {
        continue;
      }
      scanned += 1;
      const row = bySymbol.get(security.ticker.toUpperCase());
      if (!row) {
        continue;
      }
      try {
        security.name = row.name || security.name;
        security.sector = row.sector || security.sector;
        security.industry = row.industry || security.industry;
        security.currentPrice =
          this.parseNasdaqPrice(row.lastsale) ?? security.currentPrice ?? null;
        security.priceUpdatedAt =
          security.currentPrice !== null ? now : security.priceUpdatedAt;
        security.source = security.source?.includes('nasdaq_screener')
          ? security.source
          : security.source
            ? `${security.source},nasdaq_screener`
            : 'nasdaq_screener';
        security.fetchedAt = now;
        await this.securityMasterRepository.save(security);
        updated += 1;
      } catch (error) {
        failed += 1;
        this.logger.warn(
          `Failed to update Nasdaq classification for ${security.ticker}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return { scanned, updated, failed };
  }

  private aggregateHoldings(holdings: SeedHolding[]): SeedHolding[] {
    const unitPrices = holdings
      .filter((holding) => holding.shares > 0 && holding.value > 0)
      .map((holding) => holding.value / 1000 / holding.shares)
      .sort((a, b) => a - b);
    const medianUnitPrice = unitPrices[Math.floor(unitPrices.length / 2)] ?? 0;
    const legacyThousandsMultiplier = medianUnitPrice > 0 && medianUnitPrice < 1 ? 1000 : 1;
    const grouped = new Map<string, SeedHolding>();
    for (const holding of holdings) {
      const normalizedValue = (holding.value / 1000) * legacyThousandsMultiplier;
      const key = this.positionKey(holding);
      const existing = grouped.get(key);
      if (existing) {
        existing.value += normalizedValue;
        existing.shares += holding.shares;
      } else {
        grouped.set(key, { ...holding, value: normalizedValue });
      }
    }
    return [...grouped.values()];
  }

  private positionKey(holding: SeedHolding): string {
    return [
      holding.cusip,
      holding.classTitle.trim().toUpperCase(),
      (holding.putCall ?? 'STOCK').trim().toUpperCase(),
    ].join(':');
  }

  private readSeed(): GuruSeed {
    const candidates = [
      join(process.cwd(), 'src', 'markets', 'data', 'guru-13f-seed.json'),
      join(
        process.cwd(),
        'apps',
        'api',
        'src',
        'markets',
        'data',
        'guru-13f-seed.json',
      ),
      join(__dirname, 'data', 'guru-13f-seed.json'),
    ];
    const file = candidates.find((candidate) => existsSync(candidate));
    if (!file) {
      throw new Error('Development guru 13F seed file is missing.');
    }
    return JSON.parse(readFileSync(file, 'utf8')) as GuruSeed;
  }

  private async buildTickerMap(): Promise<Map<string, string>> {
    const stocks = await this.stockRepository.find({
      where: { market: 'US', active: true },
    });
    const result = new Map<string, string>();
    for (const stock of stocks) {
      const normalized = this.normalizeCompanyName(stock.name);
      if (normalized && !result.has(normalized)) {
        result.set(normalized, stock.symbol.toUpperCase());
      }
    }
    const sectorFile = [
      join(process.cwd(), 'src', 'markets', 'data', 'us-stock-sectors-seed.json'),
      join(process.cwd(), 'apps', 'api', 'src', 'markets', 'data', 'us-stock-sectors-seed.json'),
      join(__dirname, 'data', 'us-stock-sectors-seed.json'),
    ].find((candidate) => existsSync(candidate));
    if (sectorFile) {
      const payload = JSON.parse(readFileSync(sectorFile, 'utf8')) as {
        rows?: Array<{ symbol: string; name?: string }>;
      };
      for (const row of payload.rows ?? []) {
        const normalized = this.normalizeCompanyName(row.name ?? '');
        if (normalized && !result.has(normalized)) {
          result.set(normalized, row.symbol.toUpperCase());
        }
      }
    }
    return result;
  }

  private findTicker(
    cusip: string,
    issuer: string,
    classTitle: string,
    tickerMap: Map<string, string>,
    cusipTickerMap: Map<string, string>,
  ): string | null {
    const masteredTicker = cusipTickerMap.get(cusip);
    if (masteredTicker) {
      return masteredTicker;
    }
    const cusipTicker: Record<string, string> = {
      '46137V357': 'RSP',
      '81369Y605': 'XLF',
      '02079K305': 'GOOGL',
      '02079K107': 'GOOG',
      '861012102': 'STM',
      '984245100': 'YPF',
      '632307104': 'NTRA',
      '11135F101': 'AVGO',
      '874039100': 'TSM',
      '78462F103': 'SPY',
      '060505104': 'BAC',
      '01609W102': 'BABA',
      '674599105': 'OXY',
      '881624209': 'TEVA',
      '023135106': 'AMZN',
      '22266T109': 'CPNG',
    };
    if (cusipTicker[cusip]) {
      return cusipTicker[cusip];
    }
    const candidates = [
      this.normalizeCompanyName(`${issuer} ${classTitle}`),
      this.normalizeCompanyName(issuer),
    ];
    for (const candidate of candidates) {
      const exact = tickerMap.get(candidate);
      if (exact) {
        return exact;
      }
    }

    const issuerName = this.normalizeCompanyName(issuer);
    if (issuerName.length < 4) {
      return null;
    }
    for (const [name, ticker] of tickerMap) {
      if (
        name.length >= 4 &&
        (name.startsWith(issuerName) || issuerName.startsWith(name))
      ) {
        return ticker;
      }
    }
    return null;
  }

  private normalizeCompanyName(value: string): string {
    return value
      .toUpperCase()
      .replace(/&/g, ' AND ')
      .replace(
        /\b(INCORPORATED|INC|CORPORATION|CORP|COMPANY|CO|LIMITED|LTD|PLC|HOLDINGS?|GROUP|THE|COM|CLASS|CL|COMMON|STOCK|SHARES?|ADR|ADS|NEW|DEL)\b/g,
        ' ',
      )
      .replace(/[^A-Z0-9]/g, '');
  }

  private async buildSectorMap(
    tickers: string[],
  ): Promise<{
    map: Map<string, { sector: string | null; industry: string | null; currentPrice: number | null }>;
    generatedAt: string | null;
  }> {
    const result = new Map<string, { sector: string | null; industry: string | null; currentPrice: number | null }>();
    let generatedAt: string | null = null;
    const mastered = await this.securityMasterRepository.find();
    const masteredByTicker = new Map(
      mastered.flatMap((security) =>
        security.ticker
          ? [[security.ticker.toUpperCase(), security] as const]
          : [],
      ),
    );
    const candidates = [
      join(process.cwd(), 'src', 'markets', 'data', 'us-stock-sectors-seed.json'),
      join(process.cwd(), 'apps', 'api', 'src', 'markets', 'data', 'us-stock-sectors-seed.json'),
      join(__dirname, 'data', 'us-stock-sectors-seed.json'),
    ];
    const file = candidates.find((candidate) => existsSync(candidate));
    if (file) {
      const payload = JSON.parse(readFileSync(file, 'utf8')) as {
        generatedAt?: string;
        rows?: Array<{ symbol: string; sector?: string; industry?: string; currentPrice?: number | null }>;
      };
      generatedAt = payload.generatedAt ?? null;
      for (const row of payload.rows ?? []) {
        result.set(row.symbol.toUpperCase(), {
          sector: row.sector || null,
          industry: row.industry || null,
          currentPrice: row.currentPrice ?? null,
        });
      }
    }
    const profiles = tickers.length
      ? await this.profileRepository.find({ where: { symbol: In(tickers) } })
      : [];
    for (const profile of profiles) {
      const key = profile.symbol.toUpperCase();
      const current = result.get(key);
      result.set(key, {
        sector: current?.sector ?? null,
        industry: profile.industry || current?.industry || null,
        currentPrice: current?.currentPrice ?? null,
      });
    }
    for (const [ticker, security] of masteredByTicker) {
      const current = result.get(ticker);
      result.set(ticker, {
        sector: security.sector || current?.sector || null,
        industry: security.industry || current?.industry || null,
        currentPrice: security.currentPrice ?? current?.currentPrice ?? null,
      });
    }
    return { map: result, generatedAt };
  }

  private async fetchNasdaqRows(): Promise<NasdaqScreenerRow[]> {
    const url =
      'https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=10000&offset=0&download=true';
    const response = await fetch(url, {
      headers: {
        accept: 'application/json, text/plain, */*',
        'user-agent':
          this.configService.get<string>('SEC_USER_AGENT') ||
          '15F investment-community admin@15f.local',
      },
    });
    if (!response.ok) {
      throw new Error(`Nasdaq screener request failed: ${response.status}`);
    }
    const payload = (await response.json()) as {
      data?: { rows?: NasdaqScreenerRow[] };
    };
    return payload.data?.rows ?? [];
  }

  private parseNasdaqPrice(value: string | undefined): number | null {
    if (!value) {
      return null;
    }
    const parsed = Number(value.replace(/[$,]/g, '').trim());
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  private isScheduledJobsEnabled(): boolean {
    const configured = this.configService.get<string>('ENABLE_SCHEDULED_JOBS');
    if (configured !== undefined) {
      return configured === 'true';
    }
    return this.configService.get<string>('NODE_ENV') === 'production';
  }

  private toSector(industry: string | null, classTitle: string): string {
    const value = `${industry ?? ''} ${classTitle}`.toLowerCase();
    if (/etf|fund|trust|index|spdr|ishares/.test(value)) return 'ETF / Fund';
    if (/health|bio|pharma|medical|diagnostic|therapeutic|life science/.test(value)) return 'Healthcare';
    if (/software|semiconductor|technology|electronic|computer|internet|communication equipment|information tech/.test(value)) return 'Technology';
    if (/bank|financial|insurance|capital market|credit|asset management|mortgage/.test(value)) return 'Financials';
    if (/oil|gas|energy|petroleum|coal/.test(value)) return 'Energy';
    if (/consumer retail|apparel|restaurant|auto|leisure|travel|hotel|homebuilding|luxury/.test(value)) return 'Consumer Cyclical';
    if (/food|beverage|tobacco|household|personal product|grocery|consumer defensive/.test(value)) return 'Consumer Defensive';
    if (/aerospace|defense|industrial|machinery|transport|logistics|construction|airline|railroad/.test(value)) return 'Industrials';
    if (/real estate|reit/.test(value)) return 'Real Estate';
    if (/utility|utilities|electric|water/.test(value)) return 'Utilities';
    if (/media|telecom|entertainment|advertising|communication service/.test(value)) return 'Communication Services';
    if (/chemical|metal|mining|steel|paper|packaging|materials/.test(value)) return 'Basic Materials';
    return 'Other';
  }

  private stableId(value: string): string {
    const hash = createHash('sha256').update(value).digest('hex');
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
  }

  private toSummary(
    manager: GuruManagerEntity,
    topHolding: GuruHoldingEntity | null,
  ): GuruSummaryResponse {
    return {
      slug: manager.slug,
      personName: manager.personName,
      firmName: manager.firmName,
      reportDate: manager.reportDate,
      filingDate: manager.filingDate,
      totalValue: manager.totalValue,
      positionCount: manager.positionCount,
      topHolding: topHolding ? this.toHolding(topHolding) : null,
    };
  }

  private toHolding(
    holding: GuruHoldingEntity,
    classification: {
      sector: string | null;
      industry: string | null;
      currentPrice: number | null;
    } | null = null,
  ): GuruHoldingResponse {
    return {
      id: holding.id,
      ticker: holding.ticker,
      issuerName: holding.issuerName,
      cusip: holding.cusip,
      putCall: holding.putCall,
      value: holding.value,
      shares: holding.shares,
      weight: holding.weight,
      previousWeight: holding.previousWeight,
      weightChange: holding.weightChange,
      shareChange: holding.shareChange,
      returnPercent:
        classification?.currentPrice && holding.shares > 0 && holding.value > 0
          ? (classification.currentPrice / (holding.value / holding.shares) - 1) * 100
          : null,
      industry: classification?.industry ?? null,
      sector:
        classification?.sector ||
        this.toSector(classification?.industry ?? null, holding.classTitle),
    };
  }
}
