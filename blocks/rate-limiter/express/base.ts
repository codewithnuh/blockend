import { Request, Response, NextFunction } from "express";

// --- Interfaces ---
export interface RateLimitRecord {
  hits: number;
  resetTime: number; // Unix timestamp in ms
}

export interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<RateLimitRecord> | RateLimitRecord;
}

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  message: string | Record<string, unknown>;
  statusCode: number;
  standardHeaders: boolean;
  keyGenerator: (req: Request) => string;
  store: RateLimitStore; // The storage engine strategy
}

// --- Middleware Factory ---
export const rateLimit = (options: Partial<RateLimitOptions> & { store: RateLimitStore }) => {
  const config: RateLimitOptions = {
    windowMs: 60 * 1000,
    max: 100,
    message: { error: "Too many requests, please try again later." },
    statusCode: 429,
    standardHeaders: true,
    keyGenerator: (req: Request) => req.ip || req.socket.remoteAddress || "unknown-ip",
    ...options
  };

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = config.keyGenerator(req);

      // Await the store increment (handles both synchronous and asynchronous stores)
      const { hits, resetTime } = await config.store.increment(key, config.windowMs);
      const remaining = Math.max(0, config.max - hits);

      if (config.standardHeaders) {
        res.setHeader("RateLimit-Limit", config.max);
        res.setHeader("RateLimit-Remaining", remaining);
        res.setHeader("RateLimit-Reset", Math.ceil(resetTime / 1000));
      }

      if (hits > config.max) {
        res.status(config.statusCode).send(config.message);
        return;
      }

      next();
    } catch (error) {
      // Fail-open strategy: if the rate limiter storage fails, let the request pass
      // so your app doesn't crash for users, but log the error.
      // eslint-disable-next-line no-console
      console.error("Rate limiter store error:", error);
      next();
    }
  };
};
