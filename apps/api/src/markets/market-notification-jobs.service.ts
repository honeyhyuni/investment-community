import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/user.entity';
import { UserStatus } from '../users/user-status.enum';
import { FavoriteStockEntity } from './favorite-stock.entity';
import { IpoCalendarEntity } from './ipo-calendar.entity';
import { MarketsService } from './markets.service';
import { UsEarningsCalendarEntity } from './us-earnings-calendar.entity';

@Injectable()
export class MarketNotificationJobsService {
  private readonly logger = new Logger(MarketNotificationJobsService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly markets: MarketsService,
    private readonly notifications: NotificationsService,
    @InjectRepository(FavoriteStockEntity)
    private readonly favorites: Repository<FavoriteStockEntity>,
    @InjectRepository(UsEarningsCalendarEntity)
    private readonly earnings: Repository<UsEarningsCalendarEntity>,
    @InjectRepository(IpoCalendarEntity)
    private readonly ipos: Repository<IpoCalendarEntity>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  @Cron('0 * * * * *', { timeZone: 'Asia/Seoul' })
  async checkPriceBands(): Promise<void> {
    if (!this.jobsEnabled()) return;
    const rows = await this.favorites.find({ order: { createdAt: 'ASC' } });
    const symbols = new Map<string, FavoriteStockEntity[]>();
    for (const row of rows) {
      if (!this.isRegularSession(row.market)) continue;
      const key = `${row.market}:${row.symbol}`;
      const group = symbols.get(key) ?? [];
      group.push(row);
      symbols.set(key, group);
    }
    for (const group of symbols.values()) {
      const stock = group[0];
      try {
        const quote = await this.markets.getStockQuote(
          stock.symbol,
          stock.market,
        );
        const percent = quote.percentChange;
        const band = Math.floor(Math.abs(percent) / 5) * 5;
        if (!Number.isFinite(percent) || band < 5) continue;
        const direction = percent >= 0 ? 'UP' : 'DOWN';
        const tradeDate = this.dateKey(
          new Date(),
          stock.market === 'KR' ? 'Asia/Seoul' : 'America/New_York',
        );
        await this.notifications.sendToUsers(
          group.map((item) => item.userId),
          {
            type: 'PRICE',
            title: quote.name || stock.name || stock.symbol,
            body: `${band}% ${percent >= 0 ? '\uC624\uB978' : '\uB0B4\uB9B0'} ${this.formatPrice(quote.current, stock.market, quote.currency)}\uC785\uB2C8\uB2E4.`,
            url: `/?symbol=${encodeURIComponent(stock.symbol)}&market=${stock.market}`,
            data: {
              symbol: stock.symbol,
              market: stock.market,
              percentChange: percent,
              band,
              direction,
            },
            tag: `price:${stock.market}:${stock.symbol}`,
          },
          (userId) =>
            `price:${tradeDate}:${userId}:${stock.market}:${stock.symbol}:${direction}:${band}`,
        );
      } catch (error) {
        this.logger.warn(
          `Price notification check failed for ${stock.market}:${stock.symbol}: ${error instanceof Error ? error.message : 'unknown error'}`,
        );
      }
    }
  }

  @Cron('0 0 9 * * *', { timeZone: 'Asia/Seoul' })
  async sendScheduleNotifications(): Promise<void> {
    if (!this.jobsEnabled()) return;
    await Promise.allSettled([
      this.sendEarningsNotifications(),
      this.sendIpoNotifications(),
    ]);
  }

  private async sendEarningsNotifications(): Promise<void> {
    const today = this.dateKey(new Date(), 'Asia/Seoul');
    const items = await this.earnings.find({ where: { reportDate: today } });
    if (!items.length) return;
    const favoriteRows = await this.favorites.find({
      where: { market: 'US', symbol: In(items.map((item) => item.symbol)) },
    });
    for (const item of items) {
      const audience = favoriteRows
        .filter((favorite) => favorite.symbol === item.symbol)
        .map((favorite) => favorite.userId);
      const timing = this.earningsTiming(item.timeOfTheDay);
      await this.notifications.sendToUsers(
        audience,
        {
          type: 'EARNINGS',
          title: `${item.symbol} \uC2E4\uC801\uBC1C\uD45C \uC608\uC815`,
          body: `${item.reportDate}, ${timing}, \uC608\uC0C1 EPS ${item.estimate ?? '\uBBF8\uC815'}${item.currency ? ` ${item.currency}` : ''}`,
          url: `/?symbol=${encodeURIComponent(item.symbol)}&market=US`,
          data: { earningsId: item.id, reportDate: item.reportDate },
          tag: `earnings:${item.symbol}`,
        },
        (userId) => `earnings:v3:${userId}:${item.id}:${item.reportDate}:today`,
      );
    }
  }

  private async sendIpoNotifications(): Promise<void> {
    const today = this.dateKey(new Date(), 'Asia/Seoul');
    const items = await this.ipos
      .createQueryBuilder('ipo')
      .where('ipo.subscription_start_date = :today', { today })
      .orWhere('ipo.listing_date = :today', { today })
      .getMany();
    if (!items.length) return;
    const users = await this.users.find({
      where: { status: UserStatus.Approved },
      select: { id: true },
    });
    const audience = users.map((user) => user.id);
    for (const item of items) {
      const events: Array<{ kind: 'subscription' | 'listing'; date: string }> =
        [];
      if (item.subscriptionStartDate === today)
        events.push({ kind: 'subscription', date: item.subscriptionStartDate });
      if (item.listingDate === today)
        events.push({ kind: 'listing', date: item.listingDate });
      for (const event of events) {
        const label =
          event.kind === 'subscription'
            ? '\uACF5\uBAA8\uC8FC \uCCAD\uC57D \uC2DC\uC791\uC77C\uC785\uB2C8\uB2E4.'
            : '\uC0C1\uC7A5\uC77C\uC785\uB2C8\uB2E4.';
        const endDate =
          event.kind === 'subscription'
            ? (item.subscriptionEndDate ?? event.date)
            : event.date;
        const dateRange =
          event.date === endDate ? event.date : `${event.date} ~ ${endDate}`;
        const price = this.formatIpoPrice(
          item.confirmedOfferPrice ?? item.expectedOfferPrice,
        );
        const underwriter =
          item.underwriter?.trim() || '\uC8FC\uAD00\uC0AC \uBBF8\uC815';
        await this.notifications.sendToUsers(
          audience,
          {
            type: 'IPO',
            title: `${item.corpName} ${label}`,
            body: `${dateRange}\n\uACF5\uBAA8\uAC00 : ${price}, ${underwriter}`,
            url: '/calendar/ipo',
            data: { ipoId: item.id, kind: event.kind, date: event.date },
            tag: `ipo:${item.id}:${event.kind}`,
          },
          (userId) =>
            `ipo:v3:${userId}:${item.id}:${event.kind}:${event.date}:today`,
        );
      }
    }
  }

  private isRegularSession(market: 'US' | 'KR'): boolean {
    const zone = market === 'KR' ? 'Asia/Seoul' : 'America/New_York';
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date());
    const values = Object.fromEntries(
      parts.map((part) => [part.type, part.value]),
    );
    if (values.weekday === 'Sat' || values.weekday === 'Sun') return false;
    const minutes = Number(values.hour) * 60 + Number(values.minute);
    return market === 'KR'
      ? minutes >= 9 * 60 && minutes <= 15 * 60 + 30
      : minutes >= 9 * 60 + 30 && minutes <= 16 * 60;
  }

  private dateKey(date: Date, timeZone: string): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }

  private addDays(value: string, days: number): string {
    const date = new Date(`${value}T12:00:00+09:00`);
    date.setUTCDate(date.getUTCDate() + days);
    return this.dateKey(date, 'Asia/Seoul');
  }

  private earningsTiming(value: string | null): string {
    const normalized = value?.toLowerCase() ?? '';
    if (normalized.includes('pre')) return '\uC7A5\uC804';
    if (normalized.includes('post') || normalized.includes('after'))
      return '\uC7A5\uD6C4';
    return '\uC2DC\uAC04 \uBBF8\uC815';
  }

  private formatPrice(
    value: number,
    market: 'US' | 'KR',
    currency?: string,
  ): string {
    if (market === 'KR')
      return `${Math.round(value).toLocaleString('ko-KR')}\uC6D0`;
    return `${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency || 'USD'}`;
  }

  private formatIpoPrice(value: string | null): string {
    if (!value?.trim()) return '\uACF5\uBAA8\uAC00\uACA9 \uBBF8\uC815';
    const trimmed = value.trim();
    return trimmed.includes('\uC6D0') ? trimmed : `${trimmed}\uC6D0`;
  }

  private jobsEnabled(): boolean {
    const explicit = this.config.get<string>('ENABLE_SCHEDULED_JOBS');
    return (
      explicit === 'true' ||
      (!explicit && process.env.NODE_ENV === 'production')
    );
  }
}
