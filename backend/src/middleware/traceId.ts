/**
 * Trace ID Middleware
 * Attaches a unique trace ID to every request for distributed tracing
 */

import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

declare global {
  namespace Express {
    interface Request {
      traceId: string;
    }
  }
}

// Client-supplied trace IDs land in logs — an attacker could smuggle
// control characters (log injection / forging fake log lines) or absurdly
// long values through this header. Only accept a bounded, safe charset;
// anything else is replaced with a fresh UUID.
const TRACE_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

export function traceIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers['x-trace-id'] as string | undefined;
  const traceId = incoming && TRACE_ID_PATTERN.test(incoming) ? incoming : randomUUID();
  req.traceId = traceId;
  res.setHeader('X-Trace-Id', traceId);
  next();
}
