import { parseDuration } from '../utils/parse-duration';

const DEFAULT_ACCESS_TOKEN_TTL = process.env.JWT_ACCESS_TTL ?? '15m';
const DEFAULT_REFRESH_TOKEN_TTL = process.env.JWT_REFRESH_TTL ?? '7d';

export const ACCESS_TOKEN_COOKIE = 'accessToken';
export const REFRESH_TOKEN_COOKIE = 'refreshToken';

export const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET;
export const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET;

export const ACCESS_TOKEN_TTL_MS = parseDuration(DEFAULT_ACCESS_TOKEN_TTL);
export const REFRESH_TOKEN_TTL_MS = parseDuration(DEFAULT_REFRESH_TOKEN_TTL);

export const ACCESS_TOKEN_TTL_SECONDS = Math.floor(ACCESS_TOKEN_TTL_MS / 1000);
export const REFRESH_TOKEN_TTL_SECONDS = Math.floor(
  REFRESH_TOKEN_TTL_MS / 1000,
);

export const BCRYPT_SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS ?? 10);
export const IS_PRODUCTION = process.env.NODE_ENV === 'production';

export const DEFAULT_ADMIN_EMAIL = process.env.ADMIN_EMAIL;
export const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
