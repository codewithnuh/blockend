import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { runWithLoggerContext, loggerContext, logger } from "../core.js";

// Augment Fastify types to natively recognize custom request properties without 'any' casting
declare module "fastify" {
  interface FastifyRequest {
    requestId: string;
  }
}

declare module "http" {
  interface IncomingMessage {
    _startTime?: number;
  }
}

const fastifyLoggerPlugin: FastifyPluginAsync = async (fastify) => {
  // Hook 1: Capture incoming request metadata and establish ALS context
  fastify.addHook("onRequest", (request, reply, done) => {
    const rawId = request.headers["x-request-id"]?.toString();
    request.raw._startTime = performance.now();

    runWithLoggerContext(rawId, (requestId) => {
      request.requestId = requestId;

      // Keep the response finish listener tied directly to the execution scope
      reply.raw.on("finish", () => {
        const start = request.raw._startTime || performance.now();
        logger.info(
          {
            http: {
              method: request.method,
              path: request.url,
              statusCode: reply.statusCode,
              durationMs: Math.round(performance.now() - start)
            }
          },
          `HTTP ${request.method} ${request.url} completed`
        );
      });

      done();
    });
  });

  // Hook 2: Re-bind right before running the route handler to shield the context
  fastify.addHook("preHandler", (request, _reply, done) => {
    const currentId = request.requestId;
    if (currentId) {
      loggerContext.run({ requestId: currentId }, () => {
        done();
      });
    } else {
      done();
    }
  });
};

export const fastifyLogger = fp(fastifyLoggerPlugin);
