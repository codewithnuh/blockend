import type { Hono } from "hono";
import type { Health } from "../types";

export function registerHonoHealthRoute(app: Hono, health: Health, path = "/health") {
  app.get(path, async (c) => {
    const report = await health.run();
    const statusCode = report.status === "unhealthy" ? 503 : 200;

    return c.json(report, statusCode);
  });
}
