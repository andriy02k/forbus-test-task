import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

export interface SymbolPriceUpdate {
  id: string;
  name: string;
  public: boolean;
  price: number;
  providerSymbol: string;
}

@Injectable()
export class SymbolUpdatesService {
  private readonly priceUpdatesSubject = new Subject<SymbolPriceUpdate>();

  readonly priceUpdates$ = this.priceUpdatesSubject.asObservable();

  publishPriceUpdate(symbol: SymbolPriceUpdate) {
    this.priceUpdatesSubject.next(symbol);
  }
}
