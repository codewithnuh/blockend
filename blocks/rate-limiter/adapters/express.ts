import { Request, Response, NextFunction } from "express";
import { evaluateRateLimit, RateLimitStore, RateLimitConfig } from "../core/core";
import { getClientIp } from "../utils/ip";

export interface ExpressOptions extends Partial<RateLimitConfig> {
  store: RateLimitStore;
  keyGenerator?: (req: Request) => string;
}

export const expressRateLimit = (options: ExpressOptions) => {
  const config: RateLimitConfig = {
    windowMs: 60 * 1000,
    max: 100,
    statusCode: 429,
    message: { error: "Too many requests, please try again later." },
    standardHeaders: true,
    legacyHeaders: true,
    ...options
  };

  const keyGen =
    options.keyGenerator || ((req: Request) => getClientIp(req.headers, req.socket.remoteAddress));

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = keyGen(req);
      const result = await evaluateRateLimit(key, options.store, config);

      // Set computed rate limit headers dynamically
      for (const [name, value] of Object.entries(result.headers)) {
        res.setHeader(name, value);
      }

      if (result.isBlocked) {
        res.status(result.statusCode).send(result.message);
        return;
      }

      next();
    } catch (error) {
      console.error("Rate limiter failure (Fail-Open):", error);
      next(); // Fail-open pattern intact
    }
  };
};
