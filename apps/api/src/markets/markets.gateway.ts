import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import WebSocket from 'ws';

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
export class MarketsGateway implements OnGatewayConnection, OnGatewayDisconnect {
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

  constructor(private readonly configService: ConfigService) {}

  handleConnection(): void {
    this.connectFinnhub();
  }

  handleDisconnect(): void {
    return;
  }

  @SubscribeMessage('market:subscribe')
  subscribeToSymbols(@MessageBody() body: { symbols?: string[] }): void {
    body.symbols
      ?.map((symbol) => symbol.toUpperCase().trim())
      .filter(Boolean)
      .slice(0, 12)
      .forEach((symbol) => this.subscribeSymbol(symbol));
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
      setTimeout(() => this.connectFinnhub(), 5000);
    });

    this.finnhubSocket.on('error', (error) => {
      this.logger.warn(`Finnhub socket error: ${error.message}`);
    });
  }

  private subscribeSymbol(symbol: string): void {
    this.symbols.add(symbol);

    if (this.finnhubSocket?.readyState !== WebSocket.OPEN) {
      return;
    }

    this.finnhubSocket.send(JSON.stringify({ type: 'subscribe', symbol }));
  }
}
