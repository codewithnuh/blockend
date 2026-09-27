import { Router, type Request, type Response } from "express";
import type { TokenService } from "../core/types.js";
import { errorBody, statusFor, type HttpAdapterOptions, type ProtectedAction } from "./http.js";

export type ExpressTokenAdapterOptions = HttpAdapterOptions<Request>;

/** Creates opt-in JSON routes. Privileged routes require an authorization callback. */
export function createExpressTokenRouter(
  service: TokenService,
  options: ExpressTokenAdapterOptions = {}
): Router {
  const router = Router();
  const run =
    (operation: (body: unknown) => Promise<unknown>) => async (req: Request, res: Response) => {
      try {
        res.json(await operation(req.body));
      } catch (error) {
        res.status(statusFor(error)).json(errorBody(error));
      }
    };
  const protectedRun =
    (action: ProtectedAction, operation: (body: never) => Promise<unknown>) =>
    async (req: Request, res: Response) => {
      if (!options.authorize || !(await options.authorize(action, req))) {
        res.status(403).json({ error: { code: "FORBIDDEN", message: "Forbidden" } });
        return;
      }
      await run((body) => operation(body as never))(req, res);
    };
  if (options.exposeIssue)
    router.post(
      "/issue",
      protectedRun("issue", (body) => service.issue(body))
    );
  if (options.exposeVerify)
    router.post(
      "/verify",
      run((body) => service.verify((body as { accessToken?: unknown }).accessToken as string))
    );
  router.post(
    "/refresh",
    run((body) => service.refresh((body as { refreshToken?: unknown }).refreshToken as string))
  );
  if (options.exposeRevoke)
    router.post(
      "/revoke",
      protectedRun("revoke", async (body) => {
        await service.revoke(body);
        return { revoked: true };
      })
    );
  return router;
}
