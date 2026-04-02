import { Request, Response, CookieOptions } from 'express';
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_TTL_MS,
  IS_PRODUCTION,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_TTL_MS,
} from '../constants/auth.constants';

const baseCookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: IS_PRODUCTION,
  path: '/',
};

export function setAuthCookies(
  response: Response,
  tokens: { accessToken: string; refreshToken: string },
) {
  response.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...baseCookieOptions,
    maxAge: ACCESS_TOKEN_TTL_MS,
  });

  response.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...baseCookieOptions,
    maxAge: REFRESH_TOKEN_TTL_MS,
  });
}

export function clearAuthCookies(response: Response) {
  response.clearCookie(ACCESS_TOKEN_COOKIE, baseCookieOptions);
  response.clearCookie(REFRESH_TOKEN_COOKIE, baseCookieOptions);
}

type RequestWithHeaders = Pick<Request, 'headers'>;

export function getAccessTokenFromRequest(request: RequestWithHeaders) {
  const authorizationHeader = request.headers.authorization;

  if (authorizationHeader?.startsWith('Bearer ')) {
    return authorizationHeader.slice(7).trim();
  }

  return getCookieFromRequest(request, ACCESS_TOKEN_COOKIE);
}

export function getRefreshTokenFromRequest(request: RequestWithHeaders) {
  return getCookieFromRequest(request, REFRESH_TOKEN_COOKIE);
}

function getCookieFromRequest(request: RequestWithHeaders, name: string) {
  return parseCookies(request.headers.cookie)[name];
}

function parseCookies(cookieHeader?: string) {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(';').reduce<Record<string, string>>((acc, pair) => {
    const separatorIndex = pair.indexOf('=');

    if (separatorIndex === -1) {
      return acc;
    }

    const key = pair.slice(0, separatorIndex).trim();
    const value = pair.slice(separatorIndex + 1).trim();

    if (key) {
      acc[key] = decodeURIComponent(value);
    }

    return acc;
  }, {});
}
