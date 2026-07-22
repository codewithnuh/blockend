import { evaluateRateLimit, RateLimitStore, RateLimitConfig } from "../core/core";
import { getClientIp } from "../utils/ip";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { Context, MiddlewareHandler } from "hono";

export interface HonoOptions extends Partial<RateLimitConfig> {
  store: RateLimitStore;
  keyGenerator?: (c: Context) => string;
}

export const honoRateLimit = (options: HonoOptions): MiddlewareHandler => {
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
    options.keyGenerator ||
    ((c: Context) => getClientIp(Object.fromEntries(c.req.raw.headers.entries()), undefined));

  return async (c, next) => {
    try {
      const key = keyGen(c);
      const result = await evaluateRateLimit(key, options.store, config);

      // Set computed rate limit headers dynamically
      for (const [name, value] of Object.entries(result.headers)) {
        c.header(name, value);
      }

      if (result.isBlocked) {
        return c.json(result.message, result.statusCode as ContentfulStatusCode);
      }

      await next();
    } catch (error) {
      //eslint-disable-next-line no-console
      console.error("Rate limiter failure (Fail-Open):", error);
      await next(); // Fail-open pattern intact
    }
  };
};
