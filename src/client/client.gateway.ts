import {
  ForbiddenException,
  Injectable,
  OnModuleDestroy,
} from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Server, Socket } from 'socket.io';
import { Subscription } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { UserRole } from '../auth/enums/user-role.enum';
import { RequestUser } from '../auth/interfaces/request-user.interface';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { getAccessTokenFromRequest } from '../auth/utils/cookie.util';
import { SymbolUpdatesService } from '../symbol/symbol-updates.service';
import { SymbolService } from '../symbol/symbol.service';
import { ClientConnectionsService } from './client-connections.service';
import { SubscribeSymbolsDto } from './dto/subscribe-symbols.dto';

type ClientSocket = Socket & {
  data: {
    user?: RequestUser;
  };
};

@Injectable()
@WebSocketGateway({
  namespace: '/client',
})
export class ClientGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleDestroy
{
  @WebSocketServer()
  private server: Server;

  private priceUpdatesSubscription?: Subscription;

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly authService: AuthService,
    private readonly symbolService: SymbolService,
    private readonly symbolUpdatesService: SymbolUpdatesService,
    private readonly clientConnectionsService: ClientConnectionsService,
  ) {}

  afterInit(server: Server) {
    server.use(async (socket: ClientSocket, next) => {
      try {
        const accessToken = getAccessTokenFromRequest(socket.handshake);

        if (!accessToken) {
          throw new Error('Access token is missing');
        }

        const user = await this.authService.getUserFromAccessToken(accessToken);

        if (user.role !== UserRole.CLIENT) {
          throw new ForbiddenException('Client role is required');
        }

        const existingClient = await this.userModel.findOne({
          _id: user.id,
          role: UserRole.CLIENT,
        });

        if (!existingClient) {
          throw new Error('Client not found');
        }

        if (existingClient.socketDisabled) {
          throw new Error('Socket access is disabled');
        }

        socket.data.user = user;
        next();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Socket authentication failed';

        next(new Error(message));
      }
    });

    this.priceUpdatesSubscription =
      this.symbolUpdatesService.priceUpdates$.subscribe((symbol) => {
        if (!symbol.public) {
          return;
        }

        server
          .to(this.getSymbolRoom(symbol.id))
          .emit('symbols.price.updated', symbol);
      });
  }

  handleConnection(client: ClientSocket) {
    const userId = client.data.user?.id;

    if (!userId) {
      client.disconnect(true);
      return;
    }

    this.clientConnectionsService.register(userId, client);
  }

  handleDisconnect(client: ClientSocket) {
    const userId = client.data.user?.id;

    if (!userId) {
      return;
    }

    this.clientConnectionsService.unregister(userId, client);
  }

  onModuleDestroy() {
    this.priceUpdatesSubscription?.unsubscribe();
  }

  @SubscribeMessage('symbols.subscribe')
  async subscribe(
    @ConnectedSocket() client: ClientSocket,
    @MessageBody() body: SubscribeSymbolsDto,
  ) {
    const availableSymbols = await this.resolveAvailableSymbols(body.symbolIds);

    const availableSymbolIds = new Set(
      availableSymbols.map((symbol) => symbol.id),
    );

    for (const symbol of availableSymbols) {
      await client.join(this.getSymbolRoom(symbol.id));
    }

    const response = {
      subscribed: availableSymbols,
      rejectedSymbolIds: body.symbolIds.filter(
        (symbolId) => !availableSymbolIds.has(symbolId),
      ),
    };

    client.emit('symbols.subscribed', response);

    return response;
  }

  @SubscribeMessage('symbols.unsubscribe')
  async unsubscribe(
    @ConnectedSocket() client: ClientSocket,
    @MessageBody() body: SubscribeSymbolsDto,
  ) {
    for (const symbolId of body.symbolIds) {
      await client.leave(this.getSymbolRoom(symbolId));
    }

    const response = {
      unsubscribedSymbolIds: body.symbolIds,
    };

    client.emit('symbols.unsubscribed', response);

    return response;
  }

  private getSymbolRoom(symbolId: string) {
    return `symbol:${symbolId}`;
  }

  private async resolveAvailableSymbols(symbolIds: string[]) {
    const normalizedSymbolIds = Array.from(
      new Set(symbolIds.map((symbolId) => symbolId.trim()).filter(Boolean)),
    );

    if (!normalizedSymbolIds.length) {
      return [];
    }

    const availableSymbols = await this.symbolService.findAvailableForClient();
    const availableSymbolsById = new Map(
      availableSymbols.map((symbol) => [symbol.id, symbol]),
    );

    return normalizedSymbolIds.flatMap((symbolId) => {
      const symbol = availableSymbolsById.get(symbolId);
      return symbol ? [symbol] : [];
    });
  }
}
