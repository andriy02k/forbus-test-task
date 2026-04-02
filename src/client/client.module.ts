import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { SymbolModule } from '../symbol/symbol.module';
import { ClientConnectionsService } from './client-connections.service';
import { ClientController } from './client.controller';
import { ClientGateway } from './client.gateway';

@Module({
  imports: [
    AuthModule,
    SymbolModule,
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  controllers: [ClientController],
  providers: [ClientGateway, ClientConnectionsService],
  exports: [ClientConnectionsService],
})
export class ClientModule {}
