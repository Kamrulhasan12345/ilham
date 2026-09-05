import 'dotenv/config';

export const DB = {
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'ilham',
  user: process.env.PGUSER || 'ilham_app',
  password: process.env.PGPASSWORD,
};

export const PORT = Number(process.env.PORT || 3000);

const _JWT_SECRET = process.env.JWT_SECRET;

if (!_JWT_SECRET || _JWT_SECRET === 'change-me-before-deploying' || _JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set to a real value (at least 32 characters)');
}

export const JWT_SECRET: string = _JWT_SECRET;
export const JWT_ACCESS_TTL = process.env.JWT_ACCESS_TTL || '15m';
export const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 7);
export const WEB_ORIGIN = process.env.WEB_ORIGIN || 'http://localhost:5173';
export const IS_PRODUCTION = process.env.NODE_ENV === 'production';
