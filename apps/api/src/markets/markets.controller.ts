import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth-user.type';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../users/user-role.enum';
import {
  CandlePoint,
  FavoriteStock,
  IpoCalendarItem,
  MarketNews,
  MarketBriefing,
  MarketQuote,
  Portfolio,
  StockDetail,
  StockSymbol,
  UsEarningsCalendarItem,
} from './finnhub-quote.dto';
import { IpoCalendarBatchService } from './ipo-calendar-batch.service';
import type { ChartPeriod, PortfolioInput } from './finnhub-quote.dto';
import { MarketsService } from './markets.service';
import { StockFinancialBatchService } from './stock-financial-batch.service';
import { StockMasterBatchService } from './stock-master-batch.service';
import { UsEarningsCalendarBatchService } from './us-earnings-calendar-batch.service';
import {
  UsStockFinancialsService,
  type UsStockFinancialResponse,
} from './us-stock-financials.service';
import {
  GuruPortfoliosService,
  type GuruDetailResponse,
  type GuruSummaryResponse,
} from './guru-portfolios.service';

@Controller('markets')
@UseGuards(JwtAuthGuard)
/** Authenticated market API boundary; delegates provider/cache logic to MarketsService. */
export class MarketsController {
  constructor(
    private readonly marketsService: MarketsService,
    private readonly stockMasterBatchService: StockMasterBatchService,
    private readonly stockFinancialBatchService: StockFinancialBatchService,
    private readonly ipoCalendarBatchService: IpoCalendarBatchService,
    private readonly usEarningsCalendarBatchService: UsEarningsCalendarBatchService,
    private readonly usStockFinancialsService: UsStockFinancialsService,
    private readonly guruPortfoliosService: GuruPortfoliosService,
  ) {}

  @Get('quotes')
  getQuotes(
    @Query('symbols') symbols = 'AAPL,MSFT,NVDA',
  ): Promise<MarketQuote[]> {
    return this.marketsService.getQuotes(
      symbols
        .split(',')
        .map((symbol) => symbol.trim())
        .filter(Boolean),
    );
  }

  @Get('pulse')
  getMarketPulse(): Promise<MarketQuote[]> {
    return this.marketsService.getMarketPulse();
  }

  @Get('stocks/us')
  getUsStocks(): Promise<MarketQuote[]> {
    return this.marketsService.getDefaultUsStocks();
  }

  @Get('stocks/kr')
  getKrStocks(): Promise<MarketQuote[]> {
    return this.marketsService.getDefaultKrStocks();
  }

  @Get('symbols/us')
  getUsSymbols(): Promise<StockSymbol[]> {
    return this.marketsService.getUsSymbols();
  }

  @Get('symbols/kr')
  getKrSymbols(): Promise<StockSymbol[]> {
    return this.marketsService.getKrSymbols();
  }

  @Get('favorites')
  // 내관심종목 화면에서 사용자 관심종목 목록과 현재가 스냅샷을 받는다.
  getFavoriteStocks(@CurrentUser() user: AuthUser): Promise<FavoriteStock[]> {
    return this.marketsService.getFavoriteStocks(user.sub);
  }

  @Post('favorites')
  // 종목 상세의 별 아이콘을 눌렀을 때 관심종목을 추가한다.
  addFavoriteStock(
    @CurrentUser() user: AuthUser,
    @Body() body: { symbol?: string; market?: string; name?: string },
  ): Promise<FavoriteStock> {
    return this.marketsService.addFavoriteStock(user.sub, body);
  }

  @Patch('favorites/reorder')
  // 내관심종목 화면의 편집 모드에서 드래그로 바꾼 표시 순서를 일괄 저장한다.
  async reorderFavoriteStocks(
    @CurrentUser() user: AuthUser,
    @Body() body: { favoriteIds?: string[] },
  ): Promise<{ ok: true }> {
    await this.marketsService.reorderFavoriteStocks(
      user.sub,
      body.favoriteIds ?? [],
    );
    return { ok: true };
  }

  @Delete('favorites/:market/:symbol')
  // 종목 상세 또는 관심종목 화면에서 별/삭제 버튼을 눌렀을 때 관심종목을 제거한다.
  async removeFavoriteStock(
    @CurrentUser() user: AuthUser,
    @Param('market') market: string,
    @Param('symbol') symbol: string,
  ): Promise<{ ok: true }> {
    await this.marketsService.removeFavoriteStock(user.sub, market, symbol);
    return { ok: true };
  }

  @Get('portfolios')
  getPortfolios(@CurrentUser() user: AuthUser): Promise<Portfolio[]> {
    return this.marketsService.getPortfolios(user.sub);
  }

  @Post('portfolios')
  createPortfolio(
    @CurrentUser() user: AuthUser,
    @Body() body: PortfolioInput,
  ): Promise<Portfolio> {
    return this.marketsService.createPortfolio(user.sub, body);
  }

  @Patch('portfolios/:id')
  updatePortfolio(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: PortfolioInput,
  ): Promise<Portfolio> {
    return this.marketsService.updatePortfolio(user.sub, id, body);
  }

  @Delete('portfolios/:id')
  async deletePortfolio(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    await this.marketsService.deletePortfolio(user.sub, id);
    return { ok: true };
  }

  @Get('stocks/detail')
  // 종목 상세 패널 진입 시 호출된다. 한국장은 getKoreanStockDetail로 분기한다.
  getStockDetail(
    @Query('symbol') symbol: string,
    @Query('market') market?: string,
  ): Promise<StockDetail> {
    if (market === 'KR') {
      return this.marketsService.getKoreanStockDetail(symbol);
    }

    return this.marketsService.getStockDetail(symbol);
  }

  @Get('stocks/quote')
  // 선택된 종목의 현재가 polling 또는 관심종목 현재가 보강에 사용한다.
  getStockQuote(
    @Query('symbol') symbol: string,
    @Query('market') market = 'US',
  ): Promise<MarketQuote> {
    return this.marketsService.getStockQuote(symbol, market);
  }

  @Get('stocks/financials/us')
  getUsStockFinancials(
    @Query('symbol') symbol: string,
  ): Promise<UsStockFinancialResponse> {
    return this.usStockFinancialsService.getRequired(symbol);
  }

  @Get('stocks/news')
  // 종목 상세 하단의 "이 종목의 최신 뉴스" 목록을 조회한다.
  getStockNews(
    @Query('symbol') symbol: string,
    @Query('market') market = 'US',
    @Query('language') language = 'en',
  ): Promise<MarketNews[]> {
    return this.marketsService.getStockNews(symbol, market, language);
  }

  @Get('news')
  // 뉴스 메뉴의 한국/미국 시장 뉴스 목록을 조회한다.
  getMarketNews(
    @Query('category') category = 'general',
    @Query('market') market = 'US',
    @Query('language') language = 'en',
  ): Promise<MarketNews[]> {
    return this.marketsService.getMarketNews(category, market, language);
  }

  @Get('ipos')
  getIpoCalendar(): Promise<IpoCalendarItem[]> {
    return this.ipoCalendarBatchService.getUpcomingIpos();
  }

  @Get('calendar/earnings/us')
  getUsEarningsCalendar(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('query') query?: string,
  ): Promise<UsEarningsCalendarItem[]> {
    return this.usEarningsCalendarBatchService.getUsEarningsCalendar({
      from: from ?? this.formatDateOffset(0),
      to: to ?? this.formatDateOffset(31),
      query,
    });
  }

  @Get('calendar/earnings/us/bounds')
  getUsEarningsBounds(): Promise<{
    minDate: string | null;
    maxDate: string | null;
  }> {
    return this.usEarningsCalendarBatchService.getUsEarningsBounds();
  }

  @Get('stocks/earnings/us')
  getUsStockEarnings(
    @Query('symbol') symbol: string,
  ): Promise<UsEarningsCalendarItem[]> {
    return this.usEarningsCalendarBatchService.getUsEarningsForSymbol(symbol);
  }

  @Get('briefing')
  // 마켓브리핑 메뉴에서 시장별 최신 브리핑 하나를 조회한다.
  getMarketBriefing(
    @Query('market') market = 'US',
    @Query('language') language = 'ko',
  ): Promise<MarketBriefing> {
    return this.marketsService.getLatestMarketBriefing(market, language);
  }

  @Get('briefings')
  // 마켓브리핑 목록 화면에서 시장별 브리핑 리스트를 조회한다.
  getMarketBriefings(
    @Query('market') market = 'US',
  ): Promise<MarketBriefing[]> {
    return this.marketsService.getMarketBriefings(market);
  }

  @Get('briefings/:id')
  // 공유 가능한 마켓브리핑 상세 URL에서 단일 브리핑을 조회한다.
  getMarketBriefingById(@Param('id') id: string): Promise<MarketBriefing> {
    return this.marketsService.getMarketBriefingById(id);
  }

  @Get('gurus')
  getGuruManagers(): Promise<GuruSummaryResponse[]> {
    return this.guruPortfoliosService.getManagers();
  }

  @Get('gurus/:slug')
  getGuruManager(@Param('slug') slug: string): Promise<GuruDetailResponse> {
    return this.guruPortfoliosService.getManager(slug);
  }

  @Patch('briefings/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.Admin)
  updateMarketBriefing(
    @Param('id') id: string,
    @Body() body: Partial<MarketBriefing>,
  ): Promise<MarketBriefing> {
    return this.marketsService.updateMarketBriefing(id, body);
  }

  @Delete('briefings/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.Admin)
  async deleteMarketBriefing(@Param('id') id: string): Promise<{ ok: true }> {
    await this.marketsService.deleteMarketBriefing(id);
    return { ok: true };
  }

  @Post('briefings/run')
  @UseGuards(RolesGuard)
  @Roles(UserRole.Admin)
  runMarketBriefing(@Query('market') market = 'US'): Promise<MarketBriefing> {
    return this.marketsService.runMarketBriefing(market);
  }

  @Get('candles')
  getCandles(
    @Query('symbol') symbol: string,
    @Query('period') period: ChartPeriod = '1M',
    @Query('market') market?: string,
    @Query('warmup') warmup?: string,
  ): Promise<CandlePoint[]> {
    return this.marketsService.getCandles(symbol, period, warmup === 'true');
  }

  @Post('profiles/batch')
  @UseGuards(RolesGuard)
  @Roles(UserRole.Admin)
  refreshDefaultProfiles(): Promise<{ updated: number }> {
    return this.marketsService.refreshDefaultProfiles();
  }

  @Post('master/batch')
  @UseGuards(RolesGuard)
  @Roles(UserRole.Admin)
  refreshStockMaster(): Promise<{ kr: number; us: number; dart: number }> {
    return this.stockMasterBatchService.refreshAll();
  }

  @Post('financials/batch')
  @UseGuards(RolesGuard)
  @Roles(UserRole.Admin)
  refreshStockFinancials(
    @Query('limit') limit?: string,
  ): Promise<{ stocks: number; rows: number; failed: number }> {
    return this.stockFinancialBatchService.refreshRecentFinancials(
      limit ? Number(limit) : undefined,
    );
  }

  @Post('financials/backfill')
  @UseGuards(RolesGuard)
  @Roles(UserRole.Admin)
  backfillStockFinancials(
    @Query('startYear') startYear?: string,
    @Query('endYear') endYear?: string,
    @Query('limit') limit?: string,
  ): Promise<{
    stocks: number;
    rows: number;
    failed: number;
    years: number[];
  }> {
    return this.stockFinancialBatchService.backfillAnnualFinancials(
      startYear ? Number(startYear) : undefined,
      endYear ? Number(endYear) : undefined,
      limit ? Number(limit) : undefined,
    );
  }

  @Post('ipos/batch')
  @UseGuards(RolesGuard)
  @Roles(UserRole.Admin)
  refreshIpoCalendar(): Promise<{
    scanned: number;
    updated: number;
    failed: number;
  }> {
    return this.ipoCalendarBatchService.refreshUpcomingIpos();
  }

  @Post('calendar/earnings/us/batch')
  @UseGuards(RolesGuard)
  @Roles(UserRole.Admin)
  refreshUsEarningsCalendar(): Promise<{
    fetched: number;
    updated: number;
    deleted: number;
    finnhubFetched: number;
    finnhubUpdated: number;
    actualUpdated: number;
  }> {
    return this.usEarningsCalendarBatchService.refreshUsEarningsCalendar();
  }

  @Post('calendar/earnings/us/actuals')
  @UseGuards(RolesGuard)
  @Roles(UserRole.Admin)
  refreshDueUsEarningsActuals(): Promise<{
    checkedDates: string[];
    fetched: number;
    updated: number;
    actualUpdated: number;
  }> {
    return this.usEarningsCalendarBatchService.refreshDueFinnhubActuals();
  }

  @Post('calendar/earnings/us/sec-confirmations')
  @UseGuards(RolesGuard)
  @Roles(UserRole.Admin)
  refreshUsEarningsSecConfirmations(): Promise<{
    checked: number;
    confirmed: number;
  }> {
    return this.usEarningsCalendarBatchService.refreshSecConfirmations();
  }

  @Post('gurus/batch')
  @UseGuards(RolesGuard)
  @Roles(UserRole.Admin)
  refreshGuruPortfolios(@Query('force') force?: string): Promise<{
    managers: number;
    holdings: number;
    skippedManagers: number;
    failedManagers: number;
    generatedAt: string;
    secDataset: {
      managers: number;
      holdings: number;
      skippedManagers: number;
      generatedAt: string;
    } | null;
    nasdaq: { scanned: number; updated: number; failed: number };
  }> {
    return this.guruPortfoliosService.refreshOperationalBatch(force === 'true');
  }

  private formatDateOffset(offsetDays: number): string {
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      '0',
    )}-${String(date.getDate()).padStart(2, '0')}`;
  }
}
