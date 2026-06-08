import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import { Server } from 'socket.io';
import WebSocket from 'ws';
import { MarketsService } from './markets.service';

type FinnhubTradeMessage =
  | {
      type: 'trade';
      data: Array<{
        p: number;
        s: string;
        t: number;
        v: number;
      }>;
    }
  | {
      type: string;
      data?: unknown;
    };

@WebSocketGateway({
  cors: {
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  },
})
export class MarketsGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MarketsGateway.name);
  private readonly symbols = new Set([
    'QQQ',
    'SPY',
    'DIA',
    'GLD',
    'USO',
    'AAPL',
    'MSFT',
    'NVDA',
    'TSLA',
  ]);
  private finnhubSocket: WebSocket | null = null;
  private pulseInterval: NodeJS.Timeout | null = null;
  private reconnectDelayMs = 5000;

  constructor(
    private readonly configService: ConfigService,
    private readonly marketsService: MarketsService,
  ) {}

  handleConnection(): void {
    this.connectFinnhub();
    this.startPulseBroadcast();
  }

  handleDisconnect(): void {
    return;
  }

  onModuleDestroy(): void {
    if (this.pulseInterval) {
      clearInterval(this.pulseInterval);
      this.pulseInterval = null;
    }
    this.finnhubSocket?.close();
  }

  @SubscribeMessage('market:subscribe')
  subscribeToSymbols(@MessageBody() body: { symbols?: string[] }): void {
    body.symbols
      ?.map((symbol) => symbol.toUpperCase().trim())
      .filter((symbol) => this.isFinnhubStreamSymbol(symbol))
      .slice(0, 24)
      .forEach((symbol) => this.subscribeSymbol(symbol));
  }

  private startPulseBroadcast(): void {
    if (this.pulseInterval) {
      return;
    }

    const broadcast = async () => {
      try {
        const pulse = await this.marketsService.getMarketPulse();
        this.server.emit('market:pulse', pulse);
      } catch (error) {
        this.logger.warn(
          `Market pulse broadcast failed: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      }
    };

    void broadcast();
    this.pulseInterval = setInterval(() => {
      void broadcast();
    }, 15000);
  }

  private connectFinnhub(): void {
    if (
      this.finnhubSocket &&
      (this.finnhubSocket.readyState === WebSocket.OPEN ||
        this.finnhubSocket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const apiKey = this.configService.get<string>('FINNHUB_API_KEY');

    if (!apiKey) {
      this.logger.warn('FINNHUB_API_KEY is not configured.');
      return;
    }

    this.finnhubSocket = new WebSocket(`wss://ws.finnhub.io?token=${apiKey}`);

    this.finnhubSocket.on('open', () => {
      this.reconnectDelayMs = 5000;
      this.symbols.forEach((symbol) => this.subscribeSymbol(symbol));
    });

    this.finnhubSocket.on('message', (rawMessage) => {
      const message = JSON.parse(rawMessage.toString()) as FinnhubTradeMessage;

      if (message.type !== 'trade' || !Array.isArray(message.data)) {
        return;
      }

      message.data.forEach((trade) => {
        this.server.emit('market:trade', {
          symbol: trade.s,
          price: trade.p,
          timestamp: trade.t,
          volume: trade.v,
        });
      });
    });

    this.finnhubSocket.on('close', () => {
      this.finnhubSocket = null;
      const delay = this.reconnectDelayMs;
      this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, 60000);
      setTimeout(() => this.connectFinnhub(), delay);
    });

    this.finnhubSocket.on('error', (error) => {
      this.logger.warn(`Finnhub socket error: ${error.message}`);
    });
  }

  private subscribeSymbol(symbol: string): void {
    if (!this.isFinnhubStreamSymbol(symbol)) {
      return;
    }

    this.symbols.add(symbol);

    if (this.finnhubSocket?.readyState !== WebSocket.OPEN) {
      return;
    }

    this.finnhubSocket.send(JSON.stringify({ type: 'subscribe', symbol }));
  }

  private isFinnhubStreamSymbol(symbol: string): boolean {
    if (!symbol || symbol.startsWith('KIS_') || symbol.startsWith('^') || symbol.includes('=')) {
      return false;
    }

    return true;
  }
}
