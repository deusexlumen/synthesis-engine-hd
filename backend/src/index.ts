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
import { errorHandler } from './middleware/errorHandler';
import { traceIdMiddleware } from './middleware/traceId';
import { generalLimiter, authLimiter } from './middleware/rateLimit';
import { requestLogger, performanceMonitor } from './lib/logger';
import { prisma } from './lib/prisma';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || (
    process.env.NODE_ENV === 'production'
      ? ['https://synthesis-engine.com', 'tauri://localhost']
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

// API routes
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/hd', generalLimiter, hdRouter);
app.use('/api/numerology', generalLimiter, numerologyRouter);
app.use('/api/synthesis', generalLimiter, synthesisRouter);
app.use('/api/ai', generalLimiter, aiRouter);
app.use('/api/transit', generalLimiter, transitRouter);
app.use('/api/coaching', generalLimiter, coachingRouter);

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Graceful shutdown
const server = app.listen(PORT, () => {
  console.log(`🚀 Synthesis Engine API running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

const gracefulShutdown = async (signal: string) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

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
