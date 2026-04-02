import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';

@Injectable()
export class ClientConnectionsService {
  private readonly socketsByUserId = new Map<string, Set<Socket>>();

  register(userId: string, socket: Socket) {
    const userSockets = this.socketsByUserId.get(userId) ?? new Set<Socket>();
    userSockets.add(socket);
    this.socketsByUserId.set(userId, userSockets);
  }

  unregister(userId: string, socket: Socket) {
    const userSockets = this.socketsByUserId.get(userId);

    if (!userSockets) {
      return;
    }

    userSockets.delete(socket);

    if (userSockets.size === 0) {
      this.socketsByUserId.delete(userId);
    }
  }

  disconnectUser(userId: string) {
    const userSockets = this.socketsByUserId.get(userId);

    if (!userSockets?.size) {
      return;
    }

    for (const socket of userSockets) {
      socket.emit('socket.disabled', {
        message: 'Socket access disabled by admin',
      });
      socket.disconnect(true);
    }

    this.socketsByUserId.delete(userId);
  }
}
