import 'dotenv/config';

const isProduction = process.env.NODE_ENV === 'production';

export function getConfig() {
  const port = Number(process.env.PORT || 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port.');
  const jwtSecret = process.env.JWT_SECRET || '';
  if (isProduction && jwtSecret.length < 32) throw new Error('Production startup requires JWT_SECRET with at least 32 characters.');
  if (!isProduction && jwtSecret && jwtSecret.length < 16) throw new Error('JWT_SECRET must contain at least 16 characters in development.');
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    isProduction,
    port,
    frontendUrl: (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, ''),
    mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aaharva',
    mongoDbName: process.env.MONGODB_DB_NAME || 'aaharva',
    jwtSecret: jwtSecret || 'development-only-change-this-secret-before-deploying',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
    cookieName: process.env.COOKIE_NAME || 'aaharva_session',
    loginRateLimitWindowMs: Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || 900000),
    loginRateLimitMax: Number(process.env.LOGIN_RATE_LIMIT_MAX || 10)
  };
}
