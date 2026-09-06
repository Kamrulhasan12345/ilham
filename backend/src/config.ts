import 'dotenv/config';

export const NODE_ENV = process.env.NODE_ENV || 'development';
export const IS_PRODUCTION = NODE_ENV === 'production';

export const DB = {
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'ilham',
  user: process.env.PGUSER || 'ilham_app',
  password: process.env.PGPASSWORD,
};

export const PORT = Number(process.env.PORT || 3000);

const rawSecret = process.env.JWT_SECRET;

function resolveJwtSecret(): string {
  if (!rawSecret) {
    if (NODE_ENV === 'development') return 'dev-only-insecure-secret-do-not-deploy';
    throw new Error('JWT_SECRET must be set');
  }
  if (rawSecret === 'change-me-before-deploying' && NODE_ENV !== 'development') {
    throw new Error('JWT_SECRET is still the placeholder value; set a real secret before deploying');
  }
  return rawSecret;
}

export const JWT_SECRET: string = resolveJwtSecret();
export const JWT_ACCESS_TTL = process.env.JWT_ACCESS_TTL || '15m';
export const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 7);
export const WEB_ORIGIN = process.env.WEB_ORIGIN || 'http://localhost:5173';
