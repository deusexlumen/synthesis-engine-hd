/**
 * Structured Logging with Pino
 * Production-ready logging with request tracing
 */

import pino from 'pino';
import { Request, Response, NextFunction } from 'express';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  base: {
    service: 'synthesis-engine-api',
    version: process.env.npm_package_version || '1.0.0',
  },
});

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(
      {
        traceId: req.traceId,
        req: {
          method: req.method,
          url: req.url,
          userId: req.user?.userId,
          ip: req.ip,
        },
        res: {
          statusCode: res.statusCode,
          duration,
        },
      },
      `${req.method} ${req.url} ${res.statusCode} ${duration}ms`
    );
  });

  next();
}

export function performanceMonitor(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;

    if (durationMs > 1000) {
      logger.warn(
        {
          traceId: req.traceId,
          type: 'slow_request',
          method: req.method,
          url: req.url,
          durationMs,
          userId: req.user?.userId,
        },
        `Slow request: ${req.method} ${req.url} took ${durationMs.toFixed(2)}ms`
      );
    }
  });

  next();
}
