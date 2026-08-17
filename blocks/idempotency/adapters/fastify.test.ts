import { describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import type { FastifyRequest } from "fastify";
import { IDEMPOTENCY_ERROR_CODES } from "../errors/codes";
import { IdempotencyError } from "../errors/idempotency-errors";
import type { IdempotencyHandler } from "../core/idempotency-handler";
import { getIdempotencyKey, idempotent } from "./fastify";
import type { IdempotencyContext } from "./fastify";
import { idempotencyErrorStatus } from "./shared";

// ---------------------------------------------------------------------------
// Test doubles
// ---------------------------------------------------------------------------

function createMockHandler() {
  const execute =
    vi.fn<
      (
        ...args: Parameters<IdempotencyHandler["execute"]>
      ) => ReturnType<IdempotencyHandler["execute"]>
    >();

  return {
    handler: { execute } as unknown as IdempotencyHandler,
    execute
  };
}

function fakeRequest(overrides: Partial<Record<string, unknown>> = {}): FastifyRequest {
  return {
    headers: {},
    body: undefined,
    query: {},
    method: "POST",
    url: "/api/payments",
    routerPath: "/api/payments",
    ...overrides
  } as unknown as FastifyRequest;
}

// ---------------------------------------------------------------------------
// getIdempotencyKey
// ---------------------------------------------------------------------------

describe("getIdempotencyKey (fastify)", () => {
  it("reads the default Idempotency-Key header case-insensitively", () => {
    const req = fakeRequest({ headers: { "idempotency-key": "key-1" } });

    expect(getIdempotencyKey(req)).toBe("key-1");
  });

  it("supports a custom header name", () => {
    const req = fakeRequest({ headers: { "x-idem": "key-x" } });

    expect(getIdempotencyKey(req, { key: { header: "X-Idem" } })).toBe("key-x");
  });

  it("falls back to a body field when configured", () => {
    const req = fakeRequest({ body: { idempotencyKey: "body-key" } });

    expect(getIdempotencyKey(req, { key: { bodyField: "idempotencyKey" } })).toBe("body-key");
  });

  it("falls back to a query parameter when configured", () => {
    const req = fakeRequest({ query: { idempotency_key: "query-key" } });

    expect(getIdempotencyKey(req, { key: { queryParam: "idempotency_key" } })).toBe("query-key");
  });

  it("prefers the header over body and query", () => {
    const req = fakeRequest({
      headers: { "idempotency-key": "header-key" },
      body: { idempotencyKey: "body-key" },
      query: { idempotency_key: "query-key" }
    });

    expect(
      getIdempotencyKey(req, {
        key: { bodyField: "idempotencyKey", queryParam: "idempotency_key" }
      })
    ).toBe("header-key");
  });

  it("returns undefined when no key is present", () => {
    expect(getIdempotencyKey(fakeRequest())).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// idempotencyErrorStatus (shared mapping)
// ---------------------------------------------------------------------------

describe("idempotencyErrorStatus", () => {
  it("maps conflicts to 409", () => {
    expect(
      idempotencyErrorStatus(
        new IdempotencyError(IDEMPOTENCY_ERROR_CODES.KEY_REUSED_WITH_DIFFERENT_REQUEST, "nope")
      )
    ).toBe(409);
  });

  it("maps client input errors to 400", () => {
    expect(
      idempotencyErrorStatus(new IdempotencyError(IDEMPOTENCY_ERROR_CODES.KEY_REQUIRED, "nope"))
    ).toBe(400);
  });

  it("maps store unavailability to 503", () => {
    expect(
      idempotencyErrorStatus(
        new IdempotencyError(IDEMPOTENCY_ERROR_CODES.STORE_UNAVAILABLE, "nope")
      )
    ).toBe(503);
  });

  it("honors a custom status map override", () => {
    expect(
      idempotencyErrorStatus(
        new IdempotencyError(IDEMPOTENCY_ERROR_CODES.REQUEST_IN_PROGRESS, "nope"),
        { REQUEST_IN_PROGRESS: 425 }
      )
    ).toBe(425);
  });
});

// ---------------------------------------------------------------------------
// idempotent (route returns a value)
// ---------------------------------------------------------------------------

describe("idempotent (fastify) — route returns a value", () => {
  it("runs the route inside handler.execute and sends the result", async () => {
    const app = Fastify({ logger: false });
    const { handler, execute } = createMockHandler();
    execute.mockImplementation(async (_u, _o, _k, _b, exec) => exec());

    app.post(
      "/pay",
      idempotent(handler, async (request) => ({
        received: request.body,
        ok: true
      }))
    );

    const res = await app.inject({
      method: "POST",
      url: "/pay",
      headers: { "idempotency-key": "key-1" },
      payload: { amount: 100 }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ received: { amount: 100 }, ok: true });
    expect(execute).toHaveBeenCalledWith(
      "anonymous",
      "POST:/pay",
      "key-1",
      { amount: 100 },
      expect.any(Function),
      undefined
    );
  });

  it("passes through without a key when requireKey is false", async () => {
    const app = Fastify({ logger: false });
    const { handler, execute } = createMockHandler();

    app.post(
      "/pay",
      idempotent(handler, async () => ({ ok: true }))
    );

    const res = await app.inject({
      method: "POST",
      url: "/pay",
      payload: { amount: 100 }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    // Unprotected: the route runs directly, execute is never called.
    expect(execute).not.toHaveBeenCalled();
  });

  it("rejects with 400 when a key is required but missing", async () => {
    const app = Fastify({ logger: false });
    const { handler, execute } = createMockHandler();

    app.post(
      "/pay",
      idempotent(handler, async () => ({ ok: true }), { requireKey: true })
    );

    const res = await app.inject({
      method: "POST",
      url: "/pay",
      payload: { amount: 100 }
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("KEY_REQUIRED");
    expect(execute).not.toHaveBeenCalled();
  });

  it("maps IdempotencyError to its HTTP status", async () => {
    const app = Fastify({ logger: false });
    const { handler, execute } = createMockHandler();
    execute.mockRejectedValue(
      new IdempotencyError(
        IDEMPOTENCY_ERROR_CODES.KEY_REUSED_WITH_DIFFERENT_REQUEST,
        "Idempotency key was already used with a different request."
      )
    );

    app.post(
      "/pay",
      idempotent(handler, async () => ({ ok: true }))
    );

    const res = await app.inject({
      method: "POST",
      url: "/pay",
      headers: { "idempotency-key": "key-1" },
      payload: { amount: 100 }
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe("KEY_REUSED_WITH_DIFFERENT_REQUEST");
  });

  it("forwards non-idempotency errors to Fastify's error handler", async () => {
    const app = Fastify({ logger: false });
    const { handler, execute } = createMockHandler();
    execute.mockRejectedValue(new Error("boom"));

    app.post(
      "/pay",
      idempotent(handler, async () => ({ ok: true }))
    );

    const res = await app.inject({
      method: "POST",
      url: "/pay",
      headers: { "idempotency-key": "key-1" },
      payload: { amount: 100 }
    });

    expect(res.statusCode).toBe(500);
    expect(res.json().message).toBe("boom");
  });

  it("resolves userId/operation/body through the option hooks", async () => {
    const app = Fastify({ logger: false });
    const { handler, execute } = createMockHandler();
    execute.mockImplementation(async (_u, _o, _k, _b, exec) => exec());

    app.post(
      "/pay",
      idempotent(handler, async () => ({ ok: true }), {
        getUserId: (request) => (request.headers["x-user-id"] as string | undefined) ?? "anon",
        getOperation: () => "payments:create",
        getBody: (request) => (request.body as { amount?: number }).amount
      })
    );

    const res = await app.inject({
      method: "POST",
      url: "/pay",
      headers: {
        "idempotency-key": "key-1",
        "x-user-id": "alice"
      },
      payload: { amount: 100, note: "ignored" }
    });

    expect(res.statusCode).toBe(200);
    expect(execute).toHaveBeenCalledWith(
      "alice",
      "payments:create",
      "key-1",
      100,
      expect.any(Function),
      undefined
    );
  });

  it("attaches the idempotency context to the request", async () => {
    const app = Fastify({ logger: false });
    const { handler, execute } = createMockHandler();
    execute.mockImplementation(async (_u, _o, _k, _b, exec) => exec());
    const contexts: Array<IdempotencyContext | undefined> = [];

    app.addHook("onResponse", (request, _reply, done) => {
      contexts.push(request.idempotency);
      done();
    });
    app.post(
      "/pay",
      idempotent(handler, async () => ({ ok: true }))
    );

    await app.inject({
      method: "POST",
      url: "/pay",
      headers: { "idempotency-key": "key-1" },
      payload: { amount: 100 }
    });

    expect(contexts[0]).toMatchObject({
      key: "key-1",
      userId: "anonymous",
      operation: "POST:/pay",
      outcome: "completed"
    });
    expect(contexts[0]?.requestHash).toHaveLength(64);
  });
});

// ---------------------------------------------------------------------------
// idempotent — reply.send style + double-send guards
// ---------------------------------------------------------------------------

describe("idempotent (fastify) — reply.send capture & guards", () => {
  it("captures a reply.send payload and stores it (no double send)", async () => {
    const app = Fastify({ logger: false });
    const { handler, execute } = createMockHandler();
    execute.mockImplementation(async (_u, _o, _k, _b, exec) => exec());

    app.post(
      "/send",
      idempotent(handler, async (_request, reply) => {
        reply.send({ via: "send", ok: true });
      })
    );

    const res = await app.inject({
      method: "POST",
      url: "/send",
      headers: { "idempotency-key": "key-1" },
      payload: { amount: 100 }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ via: "send", ok: true });
    // The route sent once; the wrapper must not attempt a second send.
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("does not crash when the route responds and the idempotency layer then fails", async () => {
    const app = Fastify({ logger: false });
    const execute = vi
      .fn<
        (
          ...args: Parameters<IdempotencyHandler["execute"]>
        ) => ReturnType<IdempotencyHandler["execute"]>
      >()
      .mockImplementation(async (_u, _o, _k, _b, run) => {
        await run();
        // The route already replied, but the idempotency layer rejects.
        throw new IdempotencyError(
          IDEMPOTENCY_ERROR_CODES.REQUEST_IN_PROGRESS,
          "concurrent request"
        );
      });
    const handler = { execute } as unknown as IdempotencyHandler;

    app.post(
      "/guard",
      idempotent(handler, async (_request, reply) => {
        reply.send({ sent: true });
      })
    );

    const res = await app.inject({
      method: "POST",
      url: "/guard",
      headers: { "idempotency-key": "key-1" },
      payload: { amount: 100 }
    });

    // Exactly one send — the route's — no "reply already sent" crash.
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ sent: true });
  });

  it("maps a permanent failure to the configured statusMap override", async () => {
    const app = Fastify({ logger: false });
    const { handler, execute } = createMockHandler();
    execute.mockRejectedValue(
      new IdempotencyError(IDEMPOTENCY_ERROR_CODES.REQUEST_IN_PROGRESS, "busy")
    );

    app.post(
      "/pay",
      idempotent(handler, async () => ({ ok: true }), {
        statusMap: { REQUEST_IN_PROGRESS: 425 }
      })
    );

    const res = await app.inject({
      method: "POST",
      url: "/pay",
      headers: { "idempotency-key": "key-1" },
      payload: { amount: 100 }
    });

    expect(res.statusCode).toBe(425);
  });
});
