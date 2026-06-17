import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth-user.type';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../users/user-role.enum';
import {
  CandlePoint,
  FavoriteStock,
  MarketNews,
  MarketBriefing,
  MarketQuote,
  StockDetail,
  StockSymbol,
} from './finnhub-quote.dto';
import type { ChartPeriod } from './finnhub-quote.dto';
import { MarketsService } from './markets.service';
import { StockFinancialBatchService } from './stock-financial-batch.service';
import { StockMasterBatchService } from './stock-master-batch.service';

@Controller('markets')
@UseGuards(JwtAuthGuard)
/** Authenticated market API boundary; delegates provider/cache logic to MarketsService. */
export class MarketsController {
  constructor(
    private readonly marketsService: MarketsService,
    private readonly stockMasterBatchService: StockMasterBatchService,
    private readonly stockFinancialBatchService: StockFinancialBatchService,
  ) {}

  @Get('quotes')
  getQuotes(@Query('symbols') symbols = 'AAPL,MSFT,NVDA'): Promise<MarketQuote[]> {
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
  runMarketBriefing(
    @Query('market') market = 'US',
  ): Promise<MarketBriefing> {
    return this.marketsService.runMarketBriefing(market);
  }

  @Get('candles')
  getCandles(
    @Query('symbol') symbol: string,
    @Query('period') period: ChartPeriod = '1M',
    @Query('market') market?: string,
  ): Promise<CandlePoint[]> {
    return this.marketsService.getCandles(symbol, period);
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
}
