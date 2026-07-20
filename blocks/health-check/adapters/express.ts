import type { Express, Request, Response } from "express";
import type { Health } from "../types/index"; // Adjust path to your core block

export function registerExpressHealthRoute(app: Express, health: Health, path = "/health") {
  app.get(path, async (_req: Request, res: Response) => {
    const report = await health.run();

    // 503 for unhealthy (pull from load balancer)
    // 200 for healthy/degraded (keep in rotation, let the JSON report show the degraded state)
    const statusCode = report.status === "unhealthy" ? 503 : 200;

    res.status(statusCode).json(report);
  });
}
