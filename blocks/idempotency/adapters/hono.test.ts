import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { Context } from "hono";
import { IDEMPOTENCY_ERROR_CODES } from "../errors/codes";
import { IdempotencyError } from "../errors/idempotency-errors";
import type { IdempotencyHandler } from "../core/idempotency-handler";
import {
  getIdempotencyContext,
  getIdempotencyKey,
  idempotencyMiddleware,
  idempotent
} from "./hono";

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

function fakeContext(overrides: Partial<Record<string, unknown>> = {}): Context {
  const headers = new Headers((overrides.headers as Record<string, string> | undefined) ?? {});
  const url = (overrides.url as string | undefined) ?? "http://localhost/pay";

  return {
    req: {
      header: (name: string) => headers.get(name) ?? undefined,
      query: (name: string) => new URL(url).searchParams.get(name) ?? undefined,
      path: new URL(url).pathname,
      method: "POST",
      raw: new Request(url, {
        method: "POST",
        headers,
        ...(overrides.body === undefined ? {} : { body: overrides.body as BodyInit })
      })
    },
    ...overrides
  } as unknown as Context;
}

// ---------------------------------------------------------------------------
// getIdempotencyKey
// ---------------------------------------------------------------------------

describe("getIdempotencyKey (hono)", () => {
  it("reads the default Idempotency-Key header", async () => {
    const c = fakeContext({ headers: { "idempotency-key": "key-1" } });

    expect(await getIdempotencyKey(c)).toBe("key-1");
  });

  it("supports a custom header name", async () => {
    const c = fakeContext({ headers: { "x-idem": "key-x" } });

    expect(await getIdempotencyKey(c, { key: { header: "X-Idem" } })).toBe("key-x");
  });

  it("falls back to a query parameter when configured", async () => {
    const c = fakeContext({ url: "http://localhost/pay?idempotency_key=q" });

    expect(await getIdempotencyKey(c, { key: { queryParam: "idempotency_key" } })).toBe("q");
  });

  it("falls back to a body field when configured", async () => {
    const c = fakeContext({
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idempotencyKey: "body-key" })
    });

    expect(await getIdempotencyKey(c, { key: { bodyField: "idempotencyKey" } })).toBe("body-key");
  });

  it("prefers the header over query and body", async () => {
    const c = fakeContext({
      url: "http://localhost/pay?idempotency_key=q",
      headers: { "idempotency-key": "header-key" },
      body: JSON.stringify({ idempotencyKey: "body-key" })
    });

    expect(
      await getIdempotencyKey(c, {
        key: { bodyField: "idempotencyKey", queryParam: "idempotency_key" }
      })
    ).toBe("header-key");
  });

  it("returns undefined when no key is present", async () => {
    expect(await getIdempotencyKey(fakeContext())).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// idempotent (route returns a payload)
// ---------------------------------------------------------------------------

describe("idempotent (hono) — route returns a payload", () => {
  it("runs the route inside handler.execute and sends the result", async () => {
    const app = new Hono();
    const { handler, execute } = createMockHandler();
    execute.mockImplementation(async (_u, _o, _k, _b, exec) => exec());

    app.post(
      "/pay",
      idempotent(handler, async (c) => ({
        received: await c.req.json(),
        ok: true
      }))
    );

    const res = await app.request("/pay", {
      method: "POST",
      headers: { "idempotency-key": "key-1" },
      body: JSON.stringify({ amount: 100 })
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: { amount: 100 }, ok: true });
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
    const app = new Hono();
    const { handler, execute } = createMockHandler();

    app.post(
      "/pay",
      idempotent(handler, async () => ({ ok: true }))
    );

    const res = await app.request("/pay", {
      method: "POST",
      body: JSON.stringify({ amount: 100 })
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(execute).not.toHaveBeenCalled();
  });

  it("rejects with 400 when a key is required but missing", async () => {
    const app = new Hono();
    const { handler, execute } = createMockHandler();

    app.post(
      "/pay",
      idempotent(handler, async () => ({ ok: true }), { requireKey: true })
    );

    const res = await app.request("/pay", {
      method: "POST",
      body: JSON.stringify({ amount: 100 })
    });

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("KEY_REQUIRED");
    expect(execute).not.toHaveBeenCalled();
  });

  it("maps IdempotencyError to its HTTP status", async () => {
    const app = new Hono();
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

    const res = await app.request("/pay", {
      method: "POST",
      headers: { "idempotency-key": "key-1" },
      body: JSON.stringify({ amount: 100 })
    });

    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("KEY_REUSED_WITH_DIFFERENT_REQUEST");
  });

  it("forwards non-idempotency errors to Hono's error handler", async () => {
    const app = new Hono();
    const { handler, execute } = createMockHandler();
    execute.mockRejectedValue(new Error("boom"));

    app.post(
      "/pay",
      idempotent(handler, async () => ({ ok: true }))
    );

    const res = await app.request("/pay", {
      method: "POST",
      headers: { "idempotency-key": "key-1" },
      body: JSON.stringify({ amount: 100 })
    });

    expect(res.status).toBe(500);
  });

  it("lets a route return an already-built Response", async () => {
    const app = new Hono();
    const { handler, execute } = createMockHandler();
    execute.mockImplementation(async (_u, _o, _k, _b, exec) => exec());

    app.post(
      "/pay",
      idempotent(handler, async (c) => c.json({ built: true }, 201))
    );

    const res = await app.request("/pay", {
      method: "POST",
      headers: { "idempotency-key": "key-1" },
      body: JSON.stringify({ amount: 100 })
    });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ built: true });
  });

  it("resolves userId/operation/body through the option hooks", async () => {
    const app = new Hono();
    const { handler, execute } = createMockHandler();
    execute.mockImplementation(async (_u, _o, _k, _b, exec) => exec());

    app.post(
      "/pay",
      idempotent(handler, async () => ({ ok: true }), {
        getUserId: (c) => c.req.header("x-user-id") ?? "anon",
        getOperation: () => "payments:create",
        getBody: (c) => c.req.raw.clone()
      })
    );

    const res = await app.request("/pay", {
      method: "POST",
      headers: {
        "idempotency-key": "key-1",
        "x-user-id": "alice"
      },
      body: JSON.stringify({ amount: 100 })
    });

    expect(res.status).toBe(200);
    // getBody returned the raw Request clone; the handler hashes whatever it
    // receives. We only assert the userId/operation resolution here.
    expect(execute.mock.calls[0]?.[0]).toBe("alice");
    expect(execute.mock.calls[0]?.[1]).toBe("payments:create");
    expect(execute.mock.calls[0]?.[2]).toBe("key-1");
  });

  it("attaches the idempotency context to the Hono context", async () => {
    const app = new Hono();
    const { handler, execute } = createMockHandler();
    execute.mockImplementation(async (_u, _o, _k, _b, exec) => exec());

    app.post(
      "/pay",
      idempotent(handler, async (c) => ({
        ctx: getIdempotencyContext(c)
      }))
    );

    const res = await app.request("/pay", {
      method: "POST",
      headers: { "idempotency-key": "key-1" },
      body: JSON.stringify({ amount: 100 })
    });

    const body = (await res.json()) as {
      ctx: { key: string; outcome: string; requestHash: string };
    };
    // The context is attached BEFORE execute, so the route observes the
    // mid-flight state: the scope is resolved, the outcome is still
    // "processing" (it flips to "completed"/"failed" once execution settles).
    expect(body.ctx).toMatchObject({
      key: "key-1",
      userId: "anonymous",
      operation: "POST:/pay",
      outcome: "processing"
    });
    expect(body.ctx.requestHash).toHaveLength(64);
  });
});

// ---------------------------------------------------------------------------
// idempotencyMiddleware (captures downstream c.json)
// ---------------------------------------------------------------------------

describe("idempotencyMiddleware (hono)", () => {
  it("captures the downstream payload and stores it as the idempotent response", async () => {
    const app = new Hono();
    const { handler, execute } = createMockHandler();
    execute.mockImplementation(async (_u, _o, _k, _b, exec) => exec());

    app.post("/pay", idempotencyMiddleware(handler), async (c) => c.json({ downstream: true }));

    const res = await app.request("/pay", {
      method: "POST",
      headers: { "idempotency-key": "key-1" },
      body: JSON.stringify({ amount: 100 })
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ downstream: true });
    expect(execute).toHaveBeenCalledWith(
      "anonymous",
      "POST:/pay",
      "key-1",
      { amount: 100 },
      expect.any(Function),
      undefined
    );
  });

  it("does not record an error response as a success", async () => {
    const app = new Hono();
    const { handler, execute } = createMockHandler();
    execute.mockImplementation(async (_u, _o, _k, _b, exec) => exec());

    app.post("/pay", idempotencyMiddleware(handler), async (c) => c.json({ error: "nope" }, 422));

    const res = await app.request("/pay", {
      method: "POST",
      headers: { "idempotency-key": "key-1" },
      body: JSON.stringify({ amount: 100 })
    });

    // The downstream 422 is passed through untouched.
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "nope" });
  });

  it("passes through without a key when requireKey is false", async () => {
    const app = new Hono();
    const { handler, execute } = createMockHandler();

    app.post("/pay", idempotencyMiddleware(handler), async (c) => c.json({ ok: true }));

    const res = await app.request("/pay", {
      method: "POST",
      body: JSON.stringify({ amount: 100 })
    });

    expect(res.status).toBe(200);
    expect(execute).not.toHaveBeenCalled();
  });

  it("rejects with 400 when a key is required but missing", async () => {
    const app = new Hono();
    const { handler, execute } = createMockHandler();

    app.post("/pay", idempotencyMiddleware(handler, { requireKey: true }), async (c) =>
      c.json({ ok: true })
    );

    const res = await app.request("/pay", {
      method: "POST",
      body: JSON.stringify({ amount: 100 })
    });

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("KEY_REQUIRED");
    expect(execute).not.toHaveBeenCalled();
  });

  it("maps IdempotencyError raised before the route runs to its status", async () => {
    const app = new Hono();
    const { handler, execute } = createMockHandler();
    execute.mockRejectedValue(
      new IdempotencyError(IDEMPOTENCY_ERROR_CODES.REQUEST_IN_PROGRESS, "busy")
    );

    app.post("/pay", idempotencyMiddleware(handler), async (c) => c.json({ ok: true }));

    const res = await app.request("/pay", {
      method: "POST",
      headers: { "idempotency-key": "key-1" },
      body: JSON.stringify({ amount: 100 })
    });

    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("REQUEST_IN_PROGRESS");
  });

  it("marks the execution failed when the downstream responds with an error status", async () => {
    const app = new Hono();
    // Capture the downstream promise: `mock.results[].value` holds the RESOLVED
    // value in vitest (not the promise), so we assert on the captured promise.
    let downstream: Promise<unknown> | undefined;
    const execute = vi
      .fn<
        (
          ...args: Parameters<IdempotencyHandler["execute"]>
        ) => ReturnType<IdempotencyHandler["execute"]>
      >()
      .mockImplementation(async (_u, _o, _k, _b, exec) => {
        downstream = exec() as Promise<unknown>;
        return downstream;
      });
    const handler = { execute } as unknown as IdempotencyHandler;

    app.post("/pay", idempotencyMiddleware(handler), async (c) =>
      c.json({ error: "route exploded" }, 500)
    );

    const res = await app.request("/pay", {
      method: "POST",
      headers: { "idempotency-key": "key-1" },
      body: JSON.stringify({ amount: 100 })
    });

    // The downstream 500 passes through untouched — an error body is never
    // recorded as a success, and the middleware must not replace the response.
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "route exploded" });

    // The downstream rejected with the error status, so the execution failed.
    await expect(downstream).rejects.toThrow("Downstream handler responded with status 500");
  });
});
