import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { ACCESS_TOKEN_SECRET } from '../constants/auth.constants';
import { AuthJwtPayload } from '../interfaces/auth-jwt-payload.interface';
import { RequestUser } from '../interfaces/request-user.interface';
import { getAccessTokenFromRequest } from '../utils/cookie.util';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<
      Request & {
        user?: RequestUser;
      }
    >();
    const accessToken = getAccessTokenFromRequest(request);

    if (!accessToken) {
      throw new UnauthorizedException('Access token is missing');
    }

    try {
      const payload = await this.jwtService.verifyAsync<AuthJwtPayload>(
        accessToken,
        {
          secret: ACCESS_TOKEN_SECRET,
        },
      );

      if (payload.type !== 'access') {
        throw new UnauthorizedException('Invalid access token');
      }

      request.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };

      return true;
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }
}
