import { ChartPeriod } from './finnhub-quote.dto';
import { MarketsService } from './markets.service';

type KisParams = Record<string, string>;
type KisGet = (
  path: string,
  params: KisParams,
  trId: string,
) => Promise<unknown>;
type TestMarketsService = {
  getPortfolioPerformance: (
    userId: string,
    portfolioId: string,
    period?: string,
    symbols?: string,
    portfolioIds?: string,
  ) => Promise<Array<{ date: string; valueKrw: number; costKrw: number; profitRate: number | null; series: Record<string, number | null> }>>;
  calculateMovingAverage: (
    source: Array<{ time: number; close: number }>,
    period: number,
    visibleFrom: number,
  ) => Array<{ time: number; value: number }>;
  getKoreanCandles: (
    symbol: string,
    period: ChartPeriod,
    warmup?: boolean,
  ) => Promise<Array<{ time: number }>>;
  toYahooRange: (
    period: ChartPeriod,
    warmup?: boolean,
  ) => {
    range: string;
    interval: string;
  };
  kisGet: jest.MockedFunction<KisGet>;
  getCandles: jest.Mock;
  getUsdKrwExchangeRate: jest.Mock;
  portfoliosRepository: {
    findOne: jest.Mock;
    find: jest.Mock;
  };
  fetchOpenAiWithRetry: (
    url: string,
    init: RequestInit,
    firstTimeoutMs: number,
    retryTimeoutMs: number,
    fallbackToDefaultTier?: boolean,
  ) => Promise<Response>;
  logger: { warn: jest.Mock };
};

function toKisDate(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function candleRow(date: string) {
  return {
    stck_bsop_date: date,
    stck_oprc: '100',
    stck_hgpr: '110',
    stck_lwpr: '90',
    stck_clpr: '105',
    acml_vol: '1000',
  };
}

describe('MarketsService Korean candles', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-30T00:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function makeService() {
    const service = Object.create(
      MarketsService.prototype,
    ) as TestMarketsService;
    service.kisGet = jest.fn<KisGet>();
    return service;
  }

  it('loads the next KIS page before the oldest returned candle', async () => {
    const service = makeService();
    const latest = new Date('2026-06-30T00:00:00Z');
    const firstPage = Array.from({ length: 100 }, (_, index) =>
      candleRow(toKisDate(addDays(latest, -index))),
    );
    const oldestFirstPage = addDays(latest, -99);
    const secondPage = [
      candleRow(toKisDate(addDays(oldestFirstPage, -1))),
      candleRow(toKisDate(addDays(oldestFirstPage, -2))),
    ];
    service.kisGet
      .mockResolvedValueOnce({ rt_cd: '0', output2: firstPage })
      .mockResolvedValueOnce({ rt_cd: '0', output2: secondPage });

    const result = await service.getKoreanCandles('005930', '1Y');

    expect(service.kisGet).toHaveBeenCalledTimes(2);
    expect(service.kisGet.mock.calls[0][1].FID_PERIOD_DIV_CODE).toBe('D');
    expect(service.kisGet.mock.calls[1][1].FID_INPUT_DATE_2).toBe(
      toKisDate(addDays(oldestFirstPage, -1)),
    );
    expect(result).toHaveLength(102);
    expect(result[0].time).toBeLessThan(result[result.length - 1].time);
  });

  it.each([
    ['3M', 'D'],
    ['6M', 'D'],
    ['3Y', 'W'],
    ['5Y', 'W'],
    ['ALL', 'M'],
  ] as const)(
    'uses the %s period with %s candles',
    async (period, interval) => {
      const service = makeService();
      service.kisGet.mockResolvedValue({
        rt_cd: '0',
        output2: [candleRow('20260630')],
      });

      await service.getKoreanCandles('005930', period);

      expect(service.kisGet.mock.calls[0][1].FID_PERIOD_DIV_CODE).toBe(
        interval,
      );
      if (period === 'ALL') {
        expect(service.kisGet.mock.calls[0][1].FID_INPUT_DATE_1).toBe(
          '19700101',
        );
      }
    },
  );

  it('paginates six months of KIS daily candles', async () => {
    const service = makeService();
    const latest = new Date('2026-06-30T00:00:00Z');
    const firstPage = Array.from({ length: 100 }, (_, index) =>
      candleRow(toKisDate(addDays(latest, -index))),
    );
    service.kisGet
      .mockResolvedValueOnce({ rt_cd: '0', output2: firstPage })
      .mockResolvedValueOnce({
        rt_cd: '0',
        output2: [candleRow(toKisDate(addDays(latest, -100)))],
      });

    const result = await service.getKoreanCandles('005930', '6M');

    expect(service.kisGet).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(101);
  });

  it.each([
    ['3M', '3mo'],
    ['6M', '6mo'],
  ] as const)('maps %s to Yahoo range %s', (period, range) => {
    const service = makeService();

    expect(service.toYahooRange(period)).toEqual({
      range,
      interval: '1d',
    });
  });

  it.each([
    ['1M', '1y', '1d'],
    ['1Y', '2y', '1d'],
    ['3Y', '5y', '1wk'],
    ['5Y', '10y', '1wk'],
  ] as const)(
    'adds enough %s history to warm up moving averages',
    (period, range, interval) => {
      const service = makeService();

      expect(service.toYahooRange(period, true)).toEqual({ range, interval });
    },
  );

  it('calculates moving averages once and clips warmup points', () => {
    const service = makeService();
    const source = Array.from({ length: 6 }, (_, index) => ({
      time: index + 1,
      close: index + 1,
    }));

    expect(service.calculateMovingAverage(source, 3, 5)).toEqual([
      { time: 5, value: 4 },
      { time: 6, value: 5 },
    ]);
  });
});

describe('MarketsService OpenAI service tiers', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('falls back from flex to default after a 429 for briefing requests', async () => {
    const service = Object.create(
      MarketsService.prototype,
    ) as TestMarketsService;
    service.logger = { warn: jest.fn() };
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: { code: 'rate_limit_exceeded' } }),
          { status: 429 },
        ),
      )
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));

    const response = await service.fetchOpenAiWithRetry(
      'https://api.openai.com/v1/responses',
      {
        method: 'POST',
        body: JSON.stringify({ model: 'gpt-5.5', service_tier: 'flex' }),
      },
      1_000,
      1_000,
      true,
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      service_tier: 'flex',
    });
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toMatchObject({
      service_tier: 'default',
    });
  });
});

describe('MarketsService portfolio performance', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-31T00:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function makeService() {
    const service = Object.create(
      MarketsService.prototype,
    ) as TestMarketsService;
    service.portfoliosRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
    };
    service.getUsdKrwExchangeRate = jest.fn();
    service.getCandles = jest.fn();
    return service;
  }

  function candle(date: string, close: number) {
    return {
      time: Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000),
      open: close,
      high: close,
      low: close,
      close,
      volume: 0,
    };
  }

  it('adds a selected-portfolio aggregate return series', async () => {
    const service = makeService();
    service.portfoliosRepository.findOne.mockResolvedValue({ id: 'p1' });
    service.portfoliosRepository.find.mockResolvedValue([
      {
        id: 'p1',
        positions: [
          {
            symbol: 'AAPL',
            market: 'US',
            quantity: '1',
            averagePrice: '90',
            startedAt: '2026-01-01',
            createdAt: new Date('2026-01-01T00:00:00Z'),
          },
        ],
      },
      {
        id: 'p2',
        positions: [
          {
            symbol: 'AAPL',
            market: 'US',
            quantity: '2',
            averagePrice: '90',
            startedAt: '2026-01-01',
            createdAt: new Date('2026-01-01T00:00:00Z'),
          },
          {
            symbol: '005930',
            market: 'KR',
            quantity: '1',
            averagePrice: '800',
            startedAt: '2026-01-02',
            createdAt: new Date('2026-01-02T00:00:00Z'),
          },
        ],
      },
    ]);
    service.getUsdKrwExchangeRate.mockResolvedValue({ current: 1000 });
    service.getCandles.mockImplementation((symbol: string) => {
      if (symbol === 'AAPL') {
        return Promise.resolve([
          candle('2026-01-01', 100),
          candle('2026-01-02', 110),
        ]);
      }
      if (symbol === '005930') {
        return Promise.resolve([
          candle('2026-01-01', 700),
          candle('2026-01-02', 1000),
        ]);
      }
      return Promise.resolve([]);
    });

    const result = await service.getPortfolioPerformance(
      'user-1',
      'p1',
      '1M',
      '',
      'p1,p2',
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      date: '2026-01-01',
      valueKrw: 300000,
      costKrw: 270800,
      profitRate: 0,
    });
    expect(result[0].series.portfolio).toBe(0);
    expect(result[1].valueKrw).toBe(331000);
    expect(result[1].series.portfolio).toBeCloseTo(10.3333, 4);
  });
});

describe('MarketsService S&P 500 metrics', () => {
  function makeService() {
    return Object.create(MarketsService.prototype) as any;
  }

  function quarter(
    fiscalYear: number,
    fiscalQuarter: number,
    eps: number | null,
    netIncome = 2_500_000,
  ) {
    return {
      fiscalYear,
      fiscalQuarter,
      revenue: 10_000_000,
      netIncome,
      eps,
      equity: 50_000_000,
    };
  }

  it('uses net income TTM for PER when one quarterly EPS is missing', () => {
    const service = makeService();
    const metrics = service.buildUsSp500Metrics(
      {
        annual: [{ fiscalYear: 2025, eps: 1, equity: 50_000_000 }],
        quarterly: [
          quarter(2025, 4, null),
          quarter(2026, 1, 1),
          quarter(2026, 2, 1),
          quarter(2026, 3, 1),
        ],
      },
      100,
      { shareOutstanding: 1 },
      { peTTM: 50 },
    );

    expect(metrics.peTTM).toBe(10);
    expect(metrics.peTTMSource).toBe('net_income_ttm');
    expect(metrics.epsTTM).toBe(1);
  });

  it('prefers complete quarterly EPS TTM for PER', () => {
    const service = makeService();
    const metrics = service.buildUsSp500Metrics(
      {
        annual: [{ fiscalYear: 2025, eps: 1, equity: 50_000_000 }],
        quarterly: [
          quarter(2025, 4, 1),
          quarter(2026, 1, 1),
          quarter(2026, 2, 1),
          quarter(2026, 3, 2),
        ],
      },
      100,
      { shareOutstanding: 1 },
      { peTTM: 50 },
    );

    expect(metrics.peTTM).toBe(20);
    expect(metrics.peTTMSource).toBe('eps_ttm');
    expect(metrics.epsTTM).toBe(5);
  });
});
