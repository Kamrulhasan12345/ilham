import 'dotenv/config';

export const DB = {
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'ilham',
  user: process.env.PGUSER || 'ilham_app',
  password: process.env.PGPASSWORD,
};

export const PORT = Number(process.env.PORT || 3000);

export const JWT_SECRET = process.env.JWT_SECRET;
export const JWT_ACCESS_TTL = process.env.JWT_ACCESS_TTL || '15m';
export const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 7);
export const WEB_ORIGIN = process.env.WEB_ORIGIN || 'http://localhost:5173';

if ((!JWT_SECRET || JWT_SECRET === 'change-me-before-deploying') && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET must be set to a real value in production');
}
