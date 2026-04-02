import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import WebSocket = require('ws');
import { SymbolDto } from '../symbol/dto/symbol.dto';
import {
  TradingSymbol,
  TradingSymbolDocument,
} from '../symbol/schemas/symbol.schema';
import { SymbolUpdatesService } from '../symbol/symbol-updates.service';

const BINANCE_STREAM_URL = 'wss://stream.binance.com:9443/ws';
const BINANCE_MINI_TICKER_SUFFIX = '@miniTicker';
const RECONNECT_DELAY_MS = 5_000;

interface BinanceMiniTickerMessage {
  e: string;
  s: string;
  c: string;
}

interface BinanceCombinedMessage {
  data?: unknown;
}

interface TrackedSymbol extends SymbolDto {}

@Injectable()
export class BinanceProviderService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(BinanceProviderService.name);
  private readonly subscribedProviderSymbols = new Set<string>();
  private readonly trackedSymbolsByProviderSymbol = new Map<
    string,
    TrackedSymbol
  >();

  private websocket?: WebSocket;
  private reconnectTimeout?: NodeJS.Timeout;
  private requestId = 0;
  private isSocketOpen = false;
  private isDestroyed = false;

  constructor(
    @InjectModel(TradingSymbol.name)
    private readonly symbolModel: Model<TradingSymbolDocument>,
    private readonly symbolUpdatesService: SymbolUpdatesService,
  ) {}

  async onApplicationBootstrap() {
    this.connect();
    await this.loadExistingSymbols();
  }

  onModuleDestroy() {
    this.isDestroyed = true;
    this.isSocketOpen = false;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = undefined;
    }

    this.websocket?.removeAllListeners();
    this.websocket?.close();
    this.websocket = undefined;
  }

  upsertSymbol(symbol: SymbolDto) {
    const normalizedProviderSymbol = this.normalizeProviderSymbol(
      symbol.providerSymbol,
    );
    const isNewSubscription = !this.subscribedProviderSymbols.has(
      normalizedProviderSymbol,
    );
    const trackedSymbol: TrackedSymbol = {
      ...symbol,
      providerSymbol: normalizedProviderSymbol,
    };

    this.trackedSymbolsByProviderSymbol.set(
      normalizedProviderSymbol,
      trackedSymbol,
    );
    this.subscribedProviderSymbols.add(normalizedProviderSymbol);

    if (isNewSubscription) {
      this.subscribeToProviderSymbols([normalizedProviderSymbol]);
    }
  }

  syncSymbol(previousSymbol: SymbolDto, nextSymbol: SymbolDto) {
    const previousProviderSymbol = this.normalizeProviderSymbol(
      previousSymbol.providerSymbol,
    );
    const nextProviderSymbol = this.normalizeProviderSymbol(
      nextSymbol.providerSymbol,
    );

    if (previousProviderSymbol !== nextProviderSymbol) {
      this.removeTrackedSymbol(previousSymbol);
      this.upsertSymbol(nextSymbol);
      return;
    }

    this.upsertSymbol(nextSymbol);
  }

  removeTrackedSymbol(symbol: Pick<SymbolDto, 'id' | 'providerSymbol'>) {
    const normalizedProviderSymbol = this.normalizeProviderSymbol(
      symbol.providerSymbol,
    );
    const trackedSymbol = this.trackedSymbolsByProviderSymbol.get(
      normalizedProviderSymbol,
    );

    if (!trackedSymbol || trackedSymbol.id !== symbol.id) {
      return;
    }

    this.trackedSymbolsByProviderSymbol.delete(normalizedProviderSymbol);
    this.subscribedProviderSymbols.delete(normalizedProviderSymbol);
    this.unsubscribeFromProviderSymbols([normalizedProviderSymbol]);
  }

  private async loadExistingSymbols() {
    const symbols = await this.symbolModel.find().sort({ createdAt: -1 });

    for (const symbol of symbols) {
      const symbolDto = this.toDto(symbol);
      const normalizedProviderSymbol = this.normalizeProviderSymbol(
        symbolDto.providerSymbol,
      );

      this.trackedSymbolsByProviderSymbol.set(normalizedProviderSymbol, {
        ...symbolDto,
        providerSymbol: normalizedProviderSymbol,
      });
      this.subscribedProviderSymbols.add(normalizedProviderSymbol);
    }

    this.subscribeToProviderSymbols([...this.subscribedProviderSymbols]);
  }

  private connect() {
    if (this.isDestroyed) {
      return;
    }

    if (
      this.websocket &&
      (this.websocket.readyState === WebSocket.OPEN ||
        this.websocket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const websocket = new WebSocket(BINANCE_STREAM_URL);
    this.websocket = websocket;

    websocket.on('open', () => {
      this.isSocketOpen = true;
      this.logger.log('Connected to Binance WebSocket stream');
      this.subscribeToProviderSymbols([...this.subscribedProviderSymbols]);
    });

    websocket.on('message', (message) => {
      this.handleMessage(message.toString());
    });

    websocket.on('ping', (data) => {
      try {
        websocket.pong(data);
      } catch (error) {
        this.logger.warn(
          `Failed to respond to Binance ping: ${this.getErrorMessage(error)}`,
        );
      }
    });

    websocket.on('error', (error) => {
      this.logger.warn(
        `Binance WebSocket error: ${this.getErrorMessage(error)}`,
      );
    });

    websocket.on('close', (code, reason) => {
      this.isSocketOpen = false;
      this.logger.warn(
        `Binance WebSocket closed with code ${code}${
          reason.length ? `: ${reason.toString()}` : ''
        }`,
      );
      this.scheduleReconnect();
    });
  }

  private scheduleReconnect() {
    if (this.isDestroyed || this.reconnectTimeout) {
      return;
    }

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = undefined;
      this.connect();
    }, RECONNECT_DELAY_MS);
  }

  private subscribeToProviderSymbols(providerSymbols: string[]) {
    this.sendControlMessage('SUBSCRIBE', providerSymbols);
  }

  private unsubscribeFromProviderSymbols(providerSymbols: string[]) {
    this.sendControlMessage('UNSUBSCRIBE', providerSymbols);
  }

  private sendControlMessage(
    method: 'SUBSCRIBE' | 'UNSUBSCRIBE',
    providerSymbols: string[],
  ) {
    if (!this.isSocketOpen || !this.websocket || !providerSymbols.length) {
      return;
    }

    const params = providerSymbols.map(
      (providerSymbol) =>
        `${providerSymbol.toLowerCase()}${BINANCE_MINI_TICKER_SUFFIX}`,
    );

    try {
      this.websocket.send(
        JSON.stringify({
          method,
          params,
          id: ++this.requestId,
        }),
      );
    } catch (error) {
      this.logger.warn(
        `Failed to send Binance ${method} message: ${this.getErrorMessage(error)}`,
      );
    }
  }

  private handleMessage(rawMessage: string) {
    let parsedMessage: unknown;

    try {
      parsedMessage = JSON.parse(rawMessage);
    } catch {
      this.logger.warn('Received invalid JSON from Binance WebSocket');
      return;
    }

    const payload = this.unwrapMessage(parsedMessage);

    if (!this.isMiniTickerMessage(payload)) {
      return;
    }

    const providerSymbol = this.normalizeProviderSymbol(payload.s);
    const trackedSymbol =
      this.trackedSymbolsByProviderSymbol.get(providerSymbol);

    if (!trackedSymbol) {
      return;
    }

    const price = Number(payload.c);

    if (!Number.isFinite(price)) {
      this.logger.warn(
        `Received invalid price from Binance for ${providerSymbol}: ${payload.c}`,
      );
      return;
    }

    trackedSymbol.price = price;

    this.symbolUpdatesService.publishPriceUpdate({
      ...trackedSymbol,
      price,
    });

    void this.symbolModel
      .updateOne({ _id: trackedSymbol.id }, { price })
      .exec()
      .catch((error) => {
        this.logger.warn(
          `Failed to persist Binance price for ${providerSymbol}: ${this.getErrorMessage(
            error,
          )}`,
        );
      });
  }

  private unwrapMessage(message: unknown) {
    if (
      typeof message === 'object' &&
      message !== null &&
      'data' in message &&
      typeof (message as BinanceCombinedMessage).data !== 'undefined'
    ) {
      return (message as BinanceCombinedMessage).data;
    }

    return message;
  }

  private isMiniTickerMessage(
    message: unknown,
  ): message is BinanceMiniTickerMessage {
    return (
      typeof message === 'object' &&
      message !== null &&
      'e' in message &&
      's' in message &&
      'c' in message &&
      (message as BinanceMiniTickerMessage).e === '24hrMiniTicker'
    );
  }

  private normalizeProviderSymbol(providerSymbol: string) {
    return providerSymbol.trim().toUpperCase();
  }

  private toDto(symbol: TradingSymbolDocument): SymbolDto {
    return {
      id: symbol.id,
      name: symbol.name,
      public: symbol.public,
      price: symbol.price,
      providerSymbol: this.normalizeProviderSymbol(symbol.providerSymbol),
    };
  }

  private getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Unknown error';
  }
}
