import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { AuthService } from '../auth/auth.service';
import { UserRole } from '../auth/enums/user-role.enum';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { ClientConnectionsService } from '../client/client-connections.service';
import { CreateClientDto } from './dto/create-client.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly authService: AuthService,
    private readonly clientConnectionsService: ClientConnectionsService,
  ) {}

  async createClient(createClientDto: CreateClientDto) {
    try {
      const client = await this.userModel.create({
        email: createClientDto.email.trim().toLowerCase(),
        passwordHash: await this.authService.hashPassword(
          createClientDto.password,
        ),
        role: UserRole.CLIENT,
        socketDisabled: false,
      });

      return this.toAdminClientDto(client);
    } catch (error) {
      this.handleDuplicateEmail(error);
    }
  }

  async disableSocket(clientId: string) {
    const client = await this.findClientOrThrow(clientId);
    client.socketDisabled = true;
    await client.save();

    this.clientConnectionsService.disconnectUser(client.id);

    return this.toAdminClientDto(client);
  }

  async removeClient(clientId: string) {
    this.validateClientId(clientId);

    const client = await this.userModel.findOneAndDelete({
      _id: clientId,
      role: UserRole.CLIENT,
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    this.clientConnectionsService.disconnectUser(client.id);

    return this.toAdminClientDto(client);
  }

  private async findClientOrThrow(clientId: string) {
    this.validateClientId(clientId);

    const client = await this.userModel.findOne({
      _id: clientId,
      role: UserRole.CLIENT,
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    return client;
  }

  private toAdminClientDto(client: UserDocument) {
    return {
      id: client.id,
      email: client.email,
      role: client.role,
      socketDisabled: client.socketDisabled,
    };
  }

  private validateClientId(clientId: string) {
    if (!isValidObjectId(clientId)) {
      throw new NotFoundException('Client not found');
    }
  }

  private handleDuplicateEmail(error: unknown): never {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    ) {
      throw new ConflictException('User with this email already exists');
    }

    throw error;
  }
}
