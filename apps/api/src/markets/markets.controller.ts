import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../users/user-role.enum';
import {
  CandlePoint,
  MarketNews,
  MarketQuote,
  StockDetail,
  StockSymbol,
} from './finnhub-quote.dto';
import type { ChartPeriod } from './finnhub-quote.dto';
import { MarketsService } from './markets.service';
import { StockMasterBatchService } from './stock-master-batch.service';

@Controller('markets')
@UseGuards(JwtAuthGuard)
export class MarketsController {
  constructor(
    private readonly marketsService: MarketsService,
    private readonly stockMasterBatchService: StockMasterBatchService,
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

  @Get('stocks/detail')
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
  getStockQuote(
    @Query('symbol') symbol: string,
    @Query('market') market = 'US',
  ): Promise<MarketQuote> {
    return this.marketsService.getStockQuote(symbol, market);
  }

  @Get('stocks/news')
  getStockNews(
    @Query('symbol') symbol: string,
    @Query('market') market = 'US',
    @Query('language') language = 'en',
  ): Promise<MarketNews[]> {
    return this.marketsService.getStockNews(symbol, market, language);
  }

  @Get('news')
  getMarketNews(
    @Query('category') category = 'general',
    @Query('market') market = 'US',
  ): Promise<MarketNews[]> {
    return this.marketsService.getMarketNews(category, market);
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
}
