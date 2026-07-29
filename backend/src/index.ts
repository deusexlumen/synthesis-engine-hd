import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

import { authRouter } from './routes/auth';
import { hdRouter } from './routes/humanDesign';
import { numerologyRouter } from './routes/numerology';
import { synthesisRouter } from './routes/synthesis';
import { aiRouter } from './routes/ai';
import { transitRouter } from './routes/transit';
import { coachingRouter } from './routes/coaching';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { traceIdMiddleware } from './middleware/traceId';
import { generalLimiter } from './middleware/rateLimit';
import { requestLogger, performanceMonitor } from './lib/logger';
import { prisma } from './lib/prisma';
import { scheduleCleanup } from './lib/cleanup';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Trust the first hop's X-Forwarded-For (reverse proxy / load balancer in
// front of the API). Without this, req.ip is always the proxy's address,
// so every client shares one rate-limit bucket.
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || (
    process.env.NODE_ENV === 'production'
      ? ['https://synthesis-engine.com']
      : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173']
  ),
  credentials: true,
}));

// Request tracing & logging
app.use(traceIdMiddleware);
app.use(requestLogger);
app.use(performanceMonitor);

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));

// Health check with database connectivity test
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected',
      version: process.env.npm_package_version || '1.0.0',
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
    });
  }
});

// API routes. authLimiter is applied per-route inside authRouter (only on
// the credential-guessing surface: login/register/forgot-password/reset-
// password) rather than here at the router level — applying it to the
// whole /api/auth prefix also throttled /me and /refresh, which the
// client's checkAuth() hits on every single app load, to 5 requests per
// 15 minutes shared across ALL of those endpoints combined.
app.use('/api/auth', generalLimiter, authRouter);
app.use('/api/hd', generalLimiter, hdRouter);
app.use('/api/numerology', generalLimiter, numerologyRouter);
app.use('/api/synthesis', generalLimiter, synthesisRouter);
app.use('/api/ai', generalLimiter, aiRouter);
app.use('/api/transit', generalLimiter, transitRouter);
app.use('/api/coaching', generalLimiter, coachingRouter);

// 404 handler (must come before the error handler — Express only invokes
// 4-arg error middleware via next(err), so registration order here doesn't
// change dispatch, but this is the conventional order)
app.use(notFoundHandler);

// Error handling
app.use(errorHandler);

// Graceful shutdown
const server = app.listen(PORT, () => {
  console.log(`🚀 Synthesis Engine API running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Expired SynthesisCache/RefreshToken/Session rows and old AuditLog entries
// otherwise accumulate forever — every login, refresh, and AI synthesis
// call writes a row and nothing deletes the ones no longer needed. Skipped
// in tests to avoid an unref'd interval keeping the Jest process alive.
const cleanupInterval = process.env.NODE_ENV === 'test' ? null : scheduleCleanup();

const gracefulShutdown = async (signal: string) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  if (cleanupInterval) clearInterval(cleanupInterval);

  server.close(async () => {
    console.log('HTTP server closed');
    try {
      await prisma.$disconnect();
      console.log('Database connections closed');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
