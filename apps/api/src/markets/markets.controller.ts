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
  CandleChart,
  FavoriteStock,
  IpoCalendarItem,
  MarketNews,
  MarketBriefing,
  MarketQuote,
  Portfolio,
  PortfolioPerformancePoint,
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
  type GuruConsensusResponse,
  type GuruSummaryResponse,
} from './guru-portfolios.service';
import { EconomicIndicatorsService } from './economic-indicators.service';
import { EconomicIndicatorEntity } from './economic-indicator.entity';

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
    private readonly economicIndicatorsService: EconomicIndicatorsService,
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
  // ?닿??ъ쥌紐??붾㈃?먯꽌 ?ъ슜??愿?ъ쥌紐?紐⑸줉怨??꾩옱媛 ?ㅻ깄?룹쓣 諛쏅뒗??
  getFavoriteStocks(@CurrentUser() user: AuthUser): Promise<FavoriteStock[]> {
    return this.marketsService.getFavoriteStocks(user.sub);
  }

  @Post('favorites')
  // 醫낅ぉ ?곸꽭??蹂??꾩씠肄섏쓣 ?뚮?????愿?ъ쥌紐⑹쓣 異붽??쒕떎.
  addFavoriteStock(
    @CurrentUser() user: AuthUser,
    @Body() body: { symbol?: string; market?: string; name?: string },
  ): Promise<FavoriteStock> {
    return this.marketsService.addFavoriteStock(user.sub, body);
  }

  @Patch('favorites/reorder')
  // ?닿??ъ쥌紐??붾㈃???몄쭛 紐⑤뱶?먯꽌 ?쒕옒洹몃줈 諛붽씔 ?쒖떆 ?쒖꽌瑜??쇨큵 ??ν븳??
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
  // 醫낅ぉ ?곸꽭 ?먮뒗 愿?ъ쥌紐??붾㈃?먯꽌 蹂???젣 踰꾪듉???뚮?????愿?ъ쥌紐⑹쓣 ?쒓굅?쒕떎.
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

  @Get('portfolios/:id/performance')
  getPortfolioPerformance(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('period') period = '1M',
    @Query('symbols') symbols = '',
  ): Promise<PortfolioPerformancePoint[]> {
    return this.marketsService.getPortfolioPerformance(user.sub, id, period, symbols);
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
  // 醫낅ぉ ?곸꽭 ?⑤꼸 吏꾩엯 ???몄텧?쒕떎. ?쒓뎅?μ? getKoreanStockDetail濡?遺꾧린?쒕떎.
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
  // ?좏깮??醫낅ぉ???꾩옱媛 polling ?먮뒗 愿?ъ쥌紐??꾩옱媛 蹂닿컯???ъ슜?쒕떎.
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
  // 醫낅ぉ ?곸꽭 ?섎떒??"??醫낅ぉ??理쒖떊 ?댁뒪" 紐⑸줉??議고쉶?쒕떎.
  getStockNews(
    @Query('symbol') symbol: string,
    @Query('market') market = 'US',
    @Query('language') language = 'en',
  ): Promise<MarketNews[]> {
    return this.marketsService.getStockNews(symbol, market, language);
  }

  @Get('news')
  // ?댁뒪 硫붾돱???쒓뎅/誘멸뎅 ?쒖옣 ?댁뒪 紐⑸줉??議고쉶?쒕떎.
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

  @Get('calendar/economic/us')
  getUsEconomicIndicators(
    @Query('limit') limit?: string,
    @Query('seriesId') seriesId?: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('latest') latest?: string,
  ): Promise<EconomicIndicatorEntity[]> {
    return this.economicIndicatorsService.list({
      limit: limit ? Number(limit) : undefined,
      seriesId,
      start,
      end,
      latest: latest === 'true',
    });
  }

  @Post('calendar/economic/us/batch')
  @UseGuards(RolesGuard)
  @Roles(UserRole.Admin)
  refreshUsEconomicIndicators(): Promise<{ updated: number; skipped: boolean }> {
    return this.economicIndicatorsService.refresh();
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

  @Get('calendar/earnings/us/mine')
  getMyUsEarningsCalendar(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<UsEarningsCalendarItem[]> {
    return this.marketsService.getMyUsEarningsCalendar(
      user.sub,
      from ?? this.formatDateOffset(0),
      to ?? this.formatDateOffset(31),
    );
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
  // 留덉폆釉뚮━??硫붾돱?먯꽌 ?쒖옣蹂?理쒖떊 釉뚮━???섎굹瑜?議고쉶?쒕떎.
  getMarketBriefing(
    @Query('market') market = 'US',
    @Query('language') language = 'ko',
  ): Promise<MarketBriefing> {
    return this.marketsService.getLatestMarketBriefing(market, language);
  }

  @Get('briefings')
  // 留덉폆釉뚮━??紐⑸줉 ?붾㈃?먯꽌 ?쒖옣蹂?釉뚮━??由ъ뒪?몃? 議고쉶?쒕떎.
  getMarketBriefings(
    @Query('market') market = 'US',
  ): Promise<MarketBriefing[]> {
    return this.marketsService.getMarketBriefings(market);
  }

  @Get('briefings/:id')
  // 怨듭쑀 媛?ν븳 留덉폆釉뚮━???곸꽭 URL?먯꽌 ?⑥씪 釉뚮━?묒쓣 議고쉶?쒕떎.
  getMarketBriefingById(@Param('id') id: string): Promise<MarketBriefing> {
    return this.marketsService.getMarketBriefingById(id);
  }

  @Get('gurus')
  getGuruManagers(): Promise<GuruSummaryResponse[]> {
    return this.guruPortfoliosService.getManagers();
  }

  @Get('gurus/consensus')
  getGuruConsensus(
    @Query('limit') limit?: string,
    @Query('sort') sort?: 'managerCount' | 'totalValue' | 'buyValue' | 'sellValue',
  ): Promise<GuruConsensusResponse[]> {
    return this.guruPortfoliosService.getConsensus(limit ? Number(limit) : 30, sort);
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
    @Query('indicators') indicators?: string,
  ): Promise<CandlePoint[] | CandleChart> {
    if (indicators === 'true') {
      return this.marketsService.getCandleChart(symbol, period);
    }
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
