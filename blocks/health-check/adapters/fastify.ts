import type { FastifyInstance } from "fastify";
import type { Health } from "../types";
export function registerFastifyHealthRoute(app: FastifyInstance, health: Health, path = "/health") {
  app.get(path, async (_request, reply) => {
    const report = await health.run();
    const statusCode = report.status === "unhealthy" ? 503 : 200;

    reply.code(statusCode).send(report);
  });
}
