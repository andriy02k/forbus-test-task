import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SymbolModule } from '../symbol/symbol.module';
import {
  TradingSymbol,
  TradingSymbolSchema,
} from '../symbol/schemas/symbol.schema';
import { BinanceProviderService } from './binance-provider.service';

@Module({
  imports: [
    forwardRef(() => SymbolModule),
    MongooseModule.forFeature([
      { name: TradingSymbol.name, schema: TradingSymbolSchema },
    ]),
  ],
  providers: [BinanceProviderService],
  exports: [BinanceProviderService],
})
export class BinanceProviderModule {}
