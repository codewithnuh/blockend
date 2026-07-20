import { FastifyRequest, FastifyReply } from "fastify";
import { evaluateRateLimit, RateLimitStore, RateLimitConfig } from "../core/core";
import { getClientIp } from "../utils/ip";

export interface FastifyOptions extends Partial<RateLimitConfig> {
  store: RateLimitStore;
  keyGenerator?: (req: FastifyRequest) => string;
}

export const fastifyRateLimit = (options: FastifyOptions) => {
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
    ((req: FastifyRequest) => getClientIp(req.headers, req.socket.remoteAddress));

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      const key = keyGen(request);
      const result = await evaluateRateLimit(key, options.store, config);

      reply.headers(result.headers);

      if (result.isBlocked) {
        reply.code(result.statusCode).send(result.message);
        return; // Halts request lifecycle execution in Fastify hooks
      }
    } catch (error) {
      request.log.error(error, "Rate limiter failure (Fail-Open)");
      // Async hook implicit return continues execution automatically (Fail-Open)
    }
  };
};
