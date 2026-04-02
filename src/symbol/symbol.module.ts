import { Module, forwardRef } from '@nestjs/common';
import { BinanceProviderModule } from '../binance-provider/binance-provider.module';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { TradingSymbol, TradingSymbolSchema } from './schemas/symbol.schema';
import { SymbolController } from './symbol.controller';
import { SymbolService } from './symbol.service';
import { SymbolUpdatesService } from './symbol-updates.service';

@Module({
  imports: [
    AuthModule,
    forwardRef(() => BinanceProviderModule),
    MongooseModule.forFeature([
      { name: TradingSymbol.name, schema: TradingSymbolSchema },
    ]),
  ],
  controllers: [SymbolController],
  providers: [SymbolService, SymbolUpdatesService],
  exports: [SymbolService, SymbolUpdatesService],
})
export class SymbolModule {}
