import { Hono, type Context } from "hono";
import type { TokenService } from "../core/types.js";
import { errorBody, statusFor, type HttpAdapterOptions } from "./http.js";

export type HonoTokenAdapterOptions = HttpAdapterOptions<Context>;

/** Creates a Hono route group. Mount it under an application-owned prefix. */
export function createHonoTokenRoutes(
  service: TokenService,
  options: HonoTokenAdapterOptions = {}
): Hono {
  const app = new Hono();
  const execute = async (c: Context, work: (body: unknown) => Promise<unknown>) => {
    try {
      return c.json(await work(await c.req.json()));
    } catch (error) {
      return c.json(errorBody(error), statusFor(error) as 400);
    }
  };
  if (options.exposeIssue)
    app.post("/issue", async (c) => {
      if (!options.authorize || !(await options.authorize("issue", c)))
        return c.json({ error: { code: "FORBIDDEN", message: "Forbidden" } }, 403);
      return execute(c, (body) => service.issue(body as never));
    });
  if (options.exposeVerify)
    app.post("/verify", (c) =>
      execute(c, (body) => service.verify((body as { accessToken: string }).accessToken))
    );
  app.post("/refresh", (c) =>
    execute(c, (body) => service.refresh((body as { refreshToken: string }).refreshToken))
  );
  if (options.exposeRevoke)
    app.post("/revoke", async (c) => {
      if (!options.authorize || !(await options.authorize("revoke", c)))
        return c.json({ error: { code: "FORBIDDEN", message: "Forbidden" } }, 403);
      return execute(c, async (body) => {
        await service.revoke(body as never);
        return { revoked: true };
      });
    });
  return app;
}
