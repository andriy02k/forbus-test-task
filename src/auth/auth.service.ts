import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { Request, Response } from 'express';
import { LoginDto } from './dto/login.dto';
import { User, UserDocument } from './schemas/user.schema';
import {
  ACCESS_TOKEN_SECRET,
  ACCESS_TOKEN_TTL_SECONDS,
  BCRYPT_SALT_ROUNDS,
  REFRESH_TOKEN_SECRET,
  REFRESH_TOKEN_TTL_SECONDS,
} from './constants/auth.constants';
import { AuthJwtPayload } from './interfaces/auth-jwt-payload.interface';
import { RequestUser } from './interfaces/request-user.interface';
import {
  clearAuthCookies,
  getAccessTokenFromRequest,
  getRefreshTokenFromRequest,
  setAuthCookies,
} from './utils/cookie.util';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto, response: Response) {
    const user = await this.userModel
      .findOne({ email: this.normalizeEmail(loginDto.email) })
      .select('+passwordHash');

    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user);
    await this.updateRefreshTokenHash(user.id, tokens.refreshToken);
    setAuthCookies(response, tokens);

    return {
      user: this.buildUserResponse(user),
    };
  }

  async refresh(request: Request, response: Response) {
    const refreshToken = getRefreshTokenFromRequest(request);

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is missing');
    }

    const payload = await this.verifyToken(
      refreshToken,
      REFRESH_TOKEN_SECRET,
      'Invalid refresh token',
    );

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.userModel
      .findById(payload.sub)
      .select('+refreshTokenHash');

    if (!user?.refreshTokenHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const isRefreshTokenValid = await bcrypt.compare(
      refreshToken,
      user.refreshTokenHash,
    );

    if (!isRefreshTokenValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokens = await this.generateTokens(user);
    await this.updateRefreshTokenHash(user.id, tokens.refreshToken);
    setAuthCookies(response, tokens);

    return {
      user: this.buildUserResponse(user),
    };
  }

  async logout(request: Request, response: Response) {
    const userId = await this.resolveUserIdForLogout(request);

    if (userId) {
      await this.userModel.findByIdAndUpdate(userId, {
        refreshTokenHash: null,
      });
    }

    clearAuthCookies(response);

    return {
      success: true,
    };
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  }

  buildUserResponse(user: Pick<UserDocument, 'id' | 'email' | 'role'>) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
    };
  }

  async getUserFromAccessToken(accessToken: string): Promise<RequestUser> {
    const payload = await this.verifyToken(
      accessToken,
      ACCESS_TOKEN_SECRET,
      'Invalid access token',
    );

    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid access token');
    }

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }

  private async resolveUserIdForLogout(request: Request) {
    const refreshToken = getRefreshTokenFromRequest(request);

    if (refreshToken) {
      const payload = await this.verifyTokenOrNull(
        refreshToken,
        REFRESH_TOKEN_SECRET,
      );

      if (payload?.type === 'refresh') {
        return payload.sub;
      }
    }

    const accessToken = getAccessTokenFromRequest(request);

    if (!accessToken) {
      return null;
    }

    const payload = await this.verifyTokenOrNull(
      accessToken,
      ACCESS_TOKEN_SECRET,
    );

    return payload?.type === 'access' ? payload.sub : null;
  }

  private async generateTokens(
    user: Pick<UserDocument, 'id' | 'email' | 'role'>,
  ) {
    const accessPayload: AuthJwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      type: 'access',
    };

    const refreshPayload: AuthJwtPayload = {
      ...accessPayload,
      type: 'refresh',
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: ACCESS_TOKEN_SECRET,
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: REFRESH_TOKEN_SECRET,
        expiresIn: REFRESH_TOKEN_TTL_SECONDS,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  private async updateRefreshTokenHash(userId: string, refreshToken: string) {
    const refreshTokenHash = await bcrypt.hash(
      refreshToken,
      BCRYPT_SALT_ROUNDS,
    );

    await this.userModel.findByIdAndUpdate(userId, { refreshTokenHash });
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private async verifyToken(
    token: string,
    secret: string,
    errorMessage: string,
  ) {
    try {
      return await this.jwtService.verifyAsync<AuthJwtPayload>(token, {
        secret,
      });
    } catch {
      throw new UnauthorizedException(errorMessage);
    }
  }

  private async verifyTokenOrNull(token: string, secret: string) {
    try {
      return await this.jwtService.verifyAsync<AuthJwtPayload>(token, {
        secret,
      });
    } catch {
      return null;
    }
  }
}
