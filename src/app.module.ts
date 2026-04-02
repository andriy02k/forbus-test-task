import 'dotenv/config';
import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BinanceProviderModule } from './binance-provider/binance-provider.module';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import { ClientModule } from './client/client.module';
import { SymbolModule } from './symbol/symbol.module';

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGO_URI),
    AdminModule,
    AuthModule,
    BinanceProviderModule,
    ClientModule,
    SymbolModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
