import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from "fastify";
import type { TokenService } from "../core/types.js";
import { errorBody, statusFor, type HttpAdapterOptions } from "./http.js";

export type FastifyTokenAdapterOptions = HttpAdapterOptions<FastifyRequest>;

/** Returns a Fastify plugin with the same security defaults as the Express adapter. */
export function createFastifyTokenPlugin(
  service: TokenService,
  options: FastifyTokenAdapterOptions = {}
): FastifyPluginAsync {
  return async (app: FastifyInstance) => {
    const execute = async (
      reply: {
        code(status: number): { send(value: unknown): unknown };
        send(value: unknown): unknown;
      },
      work: () => Promise<unknown>
    ) => {
      try {
        return reply.send(await work());
      } catch (error) {
        return reply.code(statusFor(error)).send(errorBody(error));
      }
    };
    if (options.exposeIssue)
      app.post("/issue", async (request, reply) => {
        if (!options.authorize || !(await options.authorize("issue", request)))
          return reply.code(403).send({ error: { code: "FORBIDDEN", message: "Forbidden" } });
        return execute(reply, () => service.issue(request.body as never));
      });
    if (options.exposeVerify)
      app.post("/verify", async (request, reply) =>
        execute(reply, () => service.verify((request.body as { accessToken: string }).accessToken))
      );
    app.post("/refresh", async (request, reply) =>
      execute(reply, () => service.refresh((request.body as { refreshToken: string }).refreshToken))
    );
    if (options.exposeRevoke)
      app.post("/revoke", async (request, reply) => {
        if (!options.authorize || !(await options.authorize("revoke", request)))
          return reply.code(403).send({ error: { code: "FORBIDDEN", message: "Forbidden" } });
        return execute(reply, async () => {
          await service.revoke(request.body as never);
          return { revoked: true };
        });
      });
  };
}
