import { ChartPeriod } from './finnhub-quote.dto';
import { MarketsService } from './markets.service';

type KisParams = Record<string, string>;
type KisGet = (
  path: string,
  params: KisParams,
  trId: string,
) => Promise<unknown>;
type TestMarketsService = {
  getKoreanCandles: (
    symbol: string,
    period: ChartPeriod,
  ) => Promise<Array<{ time: number }>>;
  toYahooRange: (period: ChartPeriod) => {
    range: string;
    interval: string;
  };
  kisGet: jest.MockedFunction<KisGet>;
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
});
