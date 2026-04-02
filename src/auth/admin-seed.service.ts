import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuthService } from './auth.service';
import {
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_ADMIN_PASSWORD,
} from './constants/auth.constants';
import { User, UserDocument } from './schemas/user.schema';
import { UserRole } from './enums/user-role.enum';

@Injectable()
export class AdminSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminSeedService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly authService: AuthService,
  ) {}

  async onApplicationBootstrap() {
    const adminEmail = DEFAULT_ADMIN_EMAIL.trim().toLowerCase();
    const adminExists = await this.userModel.exists({ email: adminEmail });

    if (adminExists) {
      return;
    }

    const passwordHash = await this.authService.hashPassword(
      DEFAULT_ADMIN_PASSWORD,
    );

    await this.userModel.create({
      email: adminEmail,
      passwordHash,
      role: UserRole.ADMIN,
    });

    this.logger.log(`Default admin created for ${adminEmail}`);
  }
}
