import { Hono, type Context } from "hono";
import type { TokenService } from "../core/types.js";
import { TokenError } from "../core/errors.js";
import { errorBody, requireStringField, statusFor, type HttpAdapterOptions } from "./http.js";

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
      if (error instanceof SyntaxError)
        return c.json(errorBody(new TokenError("INVALID_INPUT", "Invalid JSON request body")), 400);
      return c.json(errorBody(error), statusFor(error) as 400);
    }
  };
  if (options.exposeIssue)
    app.post("/issue", async (c) => {
      try {
        if (!options.authorize || !(await options.authorize("issue", c)))
          return c.json({ error: { code: "FORBIDDEN", message: "Forbidden" } }, 403);
      } catch {
        return c.json(errorBody(undefined), 500);
      }
      return execute(c, (body) => service.issue(body as never));
    });
  if (options.exposeVerify)
    app.post("/verify", (c) =>
      execute(c, (body) => service.verify(requireStringField(body, "accessToken")))
    );
  app.post("/refresh", (c) =>
    execute(c, (body) => service.refresh(requireStringField(body, "refreshToken")))
  );
  if (options.exposeRevoke)
    app.post("/revoke", async (c) => {
      try {
        if (!options.authorize || !(await options.authorize("revoke", c)))
          return c.json({ error: { code: "FORBIDDEN", message: "Forbidden" } }, 403);
      } catch {
        return c.json(errorBody(undefined), 500);
      }
      return execute(c, async (body) => {
        await service.revoke(body as never);
        return { revoked: true };
      });
    });
  return app;
}
