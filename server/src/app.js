import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { getConfig } from './config/env.js';
import { databaseStatus } from './config/database.js';
import { verifyRequestOrigin, noSqlSanitize } from './middleware/security.js';
import { notFound, errorHandler } from './middleware/errors.js';
import { sendData } from './utils/http.js';
import authRoutes from './routes/auth.js';
import organizationRoutes from './routes/organizations.js';
import donationRoutes from './routes/donations.js';
import marketplaceRoutes from './routes/marketplace.js';
import schoolRequestRoutes from './routes/schoolRequests.js';
import operationRoutes from './routes/operations.js';

const config = getConfig();
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', config.isProduction ? 1 : false);

app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'], connectSrc: ["'self'", config.frontendUrl],
      objectSrc: ["'none'"], frameAncestors: ["'none'"], ...(config.isProduction ? { upgradeInsecureRequests: [] } : {})
    }
  }
}));
const allowedOrigins = [...new Set([config.frontendUrl, ...(process.env.EXTRA_ALLOWED_ORIGINS || '').split(',').map(v => v.trim().replace(/\/$/, '')).filter(Boolean)])];
app.use(cors({ origin: allowedOrigins, credentials: true, methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Requested-With'] }));
app.use(express.json({ limit: '1mb', strict: true }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(cookieParser());
app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    // Log route metadata only; never log bodies, credentials, cookies, or query values.
    console.info(JSON.stringify({ method: req.method, path: req.path, status: res.statusCode, durationMs: Date.now() - startedAt }));
  });
  next();
});
app.use('/api', verifyRequestOrigin, noSqlSanitize);

const loginLimiter = rateLimit({
  windowMs: config.loginRateLimitWindowMs, limit: config.loginRateLimitMax,
  standardHeaders: 'draft-8', legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many sign-in attempts. Please try again later.' } }
});
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/register', rateLimit({ windowMs: 60 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false }));

app.get('/api/health', (_req, res) => {
  const database = databaseStatus();
  const body = { success: database.connected, data: { server: 'ok', database, uptimeSeconds: Math.floor(process.uptime()), timestamp: new Date().toISOString() } };
  return res.status(database.connected ? 200 : 503).json(body);
});
app.get('/api', (_req, res) => sendData(res, { name: 'Aaharva API', version: '1.0.0', documentation: 'See docs/API.md in the project repository.' }));
app.use('/api/auth', authRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api', marketplaceRoutes);
app.use('/api/school-requests', schoolRequestRoutes);
app.use('/api', operationRoutes);
app.use(notFound);
app.use(errorHandler);

// Avoid hanging requests when the initial MongoDB connection is unavailable.
mongoose.set('bufferCommands', false);
export default app;
