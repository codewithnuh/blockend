import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { IDEMPOTENCY_ERROR_CODES } from "../errors/codes";
import { IdempotencyError } from "../errors/idempotency-errors";
import type { IdempotencyHandler } from "../core/idempotency-handler";
import {
  getIdempotencyKey,
  idempotencyErrorStatus,
  idempotencyMiddleware,
  idempotent,
  sendIdempotencyError
} from "./express";
import type { IdempotencyContext } from "./express";

// ---------------------------------------------------------------------------
// Test doubles
// ---------------------------------------------------------------------------

type MockRes = ReturnType<typeof createMockRes>;

// The methods live on the res object itself (like a real Express response) so
// the adapter's res.json/res.send patching and restoration behaves correctly.
function createMockRes() {
  const res = {
    locals: {} as Record<string, unknown>,
    headersSent: false,
    statusCode: 200,
    _json: undefined as unknown,
    _finishHandler: undefined as (() => void) | undefined,
    status: vi.fn(),
    json: vi.fn(),
    send: vi.fn(),
    once: vi.fn()
  };

  res.status.mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json.mockImplementation((body: unknown) => {
    res._json = body;
    res.headersSent = true;
    return res;
  });
  res.send.mockImplementation((body: unknown) => {
    res._json = body;
    res.headersSent = true;
    return res;
  });
  res.once.mockImplementation((event: string, cb: () => void) => {
    if (event === "finish") {
      res._finishHandler = cb;
    }
    return res;
  });

  return res;
}

function createMockReq(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    method: "POST",
    path: "/api/payments",
    body: { amount: 100 },
    query: {},
    get: vi.fn(() => undefined),
    ...overrides
  };
}

// The handler has private fields, so a structural mock must be cast once here.
// `execute` and `hashRequest` are returned separately so tests can drive and
// assert on the mocks directly.
function createMockHandler() {
  const execute = vi.fn<
    Parameters<IdempotencyHandler["execute"]>,
    ReturnType<IdempotencyHandler["execute"]>
  >();
  const hashRequest = vi.fn<
    Parameters<IdempotencyHandler["hashRequest"]>,
    ReturnType<IdempotencyHandler["hashRequest"]>
  >(() => "hash");

  return {
    handler: { execute, hashRequest } as unknown as IdempotencyHandler,
    execute,
    hashRequest
  };
}

function nextFn() {
  return vi.fn();
}

function ctxOf(res: MockRes): IdempotencyContext {
  return res.locals.idempotency as IdempotencyContext;
}

// ---------------------------------------------------------------------------
// getIdempotencyKey
// ---------------------------------------------------------------------------

describe("getIdempotencyKey", () => {
  it("reads the default Idempotency-Key header", () => {
    const req = createMockReq({
      get: vi.fn(() => "key-1")
    }) as unknown as Request;

    expect(getIdempotencyKey(req)).toBe("key-1");
  });

  it("falls back to a body field when configured", () => {
    const req = createMockReq({
      get: vi.fn(() => undefined),
      body: { idempotencyKey: "body-key" }
    }) as unknown as Request;

    expect(getIdempotencyKey(req, { key: { bodyField: "idempotencyKey" } })).toBe("body-key");
  });

  it("falls back to a query parameter when configured", () => {
    const req = createMockReq({
      get: vi.fn(() => undefined),
      query: { idempotency_key: "query-key" }
    }) as unknown as Request;

    expect(getIdempotencyKey(req, { key: { queryParam: "idempotency_key" } })).toBe("query-key");
  });

  it("prefers the header over body and query", () => {
    const req = createMockReq({
      get: vi.fn(() => "header-key"),
      body: { idempotencyKey: "body-key" },
      query: { idempotency_key: "query-key" }
    }) as unknown as Request;

    expect(
      getIdempotencyKey(req, {
        key: {
          bodyField: "idempotencyKey",
          queryParam: "idempotency_key"
        }
      })
    ).toBe("header-key");
  });

  it("returns undefined when no key is present", () => {
    const req = createMockReq() as unknown as Request;

    expect(getIdempotencyKey(req)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// idempotencyErrorStatus / sendIdempotencyError
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

  it("sendIdempotencyError responds with the error envelope", () => {
    const res = createMockRes();
    sendIdempotencyError(
      res as unknown as Response,
      new IdempotencyError(IDEMPOTENCY_ERROR_CODES.KEY_REQUIRED, "A key is required.")
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: "KEY_REQUIRED", message: "A key is required." }
    });
  });
});

// ---------------------------------------------------------------------------
// idempotent (route returns a value)
// ---------------------------------------------------------------------------

describe("idempotent", () => {
  it("runs the route inside handler.execute and sends the result", async () => {
    const res = createMockRes();
    const req = createMockReq({
      get: vi.fn(() => "key-1")
    });
    const { handler, execute } = createMockHandler();
    execute.mockImplementation(async (_userId, _op, _key, _body, exec) => exec());
    const next = nextFn();

    const middleware = idempotent(handler, async () => ({ ok: true }));
    await middleware(
      req as unknown as Request,
      res as unknown as Response,
      next as unknown as NextFunction
    );

    expect(execute).toHaveBeenCalledWith(
      "anonymous",
      "POST:/api/payments",
      "key-1",
      { amount: 100 },
      expect.any(Function),
      undefined
    );
    expect(res.json).toHaveBeenCalledWith({ ok: true });
    expect(ctxOf(res)).toMatchObject({
      key: "key-1",
      outcome: "completed"
    });
  });

  it("passes through without a key when requireKey is false", async () => {
    const res = createMockRes();
    const req = createMockReq();
    const { handler, execute } = createMockHandler();
    const next = nextFn();

    const middleware = idempotent(handler, async () => ({ ok: true }));
    await middleware(
      req as unknown as Request,
      res as unknown as Response,
      next as unknown as NextFunction
    );

    // The route runs unprotected (no execute, no next) and its result is sent.
    expect(execute).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true });
    expect(ctxOf(res).outcome).toBe("skipped");
  });

  it("rejects with 400 when a key is required but missing", async () => {
    const res = createMockRes();
    const req = createMockReq();
    const { handler, execute } = createMockHandler();
    const next = nextFn();

    const middleware = idempotent(handler, async () => ({ ok: true }), {
      requireKey: true
    });
    await middleware(
      req as unknown as Request,
      res as unknown as Response,
      next as unknown as NextFunction
    );

    expect(execute).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: "KEY_REQUIRED" })
      })
    );
  });

  it("maps IdempotencyError to its HTTP status", async () => {
    const res = createMockRes();
    const req = createMockReq({ get: vi.fn(() => "key-1") });
    const { handler, execute } = createMockHandler();
    execute.mockRejectedValue(
      new IdempotencyError(
        IDEMPOTENCY_ERROR_CODES.KEY_REUSED_WITH_DIFFERENT_REQUEST,
        "Idempotency key was already used with a different request."
      )
    );
    const next = nextFn();

    const middleware = idempotent(handler, async () => ({ ok: true }));
    await middleware(
      req as unknown as Request,
      res as unknown as Response,
      next as unknown as NextFunction
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: "KEY_REUSED_WITH_DIFFERENT_REQUEST"
        })
      })
    );
    expect(next).not.toHaveBeenCalled();
    expect(ctxOf(res).outcome).toBe("failed");
  });

  it("forwards non-idempotency errors to next()", async () => {
    const res = createMockRes();
    const req = createMockReq({ get: vi.fn(() => "key-1") });
    const { handler, execute } = createMockHandler();
    const boom = new Error("boom");
    execute.mockRejectedValue(boom);
    const next = nextFn();

    const middleware = idempotent(handler, async () => ({ ok: true }));
    await middleware(
      req as unknown as Request,
      res as unknown as Response,
      next as unknown as NextFunction
    );

    expect(next).toHaveBeenCalledWith(boom);
  });
});

// ---------------------------------------------------------------------------
// idempotencyMiddleware (captures downstream res.json)
// ---------------------------------------------------------------------------

describe("idempotencyMiddleware", () => {
  it("stores the downstream res.json payload as the idempotent response", async () => {
    const res = createMockRes();
    const req = createMockReq({ get: vi.fn(() => "key-1") });
    const { handler, execute } = createMockHandler();
    execute.mockImplementation(async (_u, _o, _k, _b, exec) => exec());
    // `next` is the downstream stack: it responds with the JSON payload.
    const next = vi.fn(() => {
      res.json({ downstream: true });
    });

    const middleware = idempotencyMiddleware(handler);
    await middleware(
      req as unknown as Request,
      res as unknown as Response,
      next as unknown as NextFunction
    );

    // The downstream payload was captured, passed through execute, and sent —
    // the middleware must not re-send.
    expect(res.json).toHaveBeenCalledWith({ downstream: true });
    expect(execute).toHaveBeenCalledWith(
      "anonymous",
      "POST:/api/payments",
      "key-1",
      { amount: 100 },
      expect.any(Function),
      undefined
    );
    // next was invoked exactly once (by runDownstream), and the middleware did
    // not call it again.
    expect(next).toHaveBeenCalledTimes(1);
    expect(ctxOf(res).outcome).toBe("completed");
  });

  it("marks the execution failed when the downstream chain responds with an error status", async () => {
    const res = createMockRes();
    const req = createMockReq({ get: vi.fn(() => "key-1") });
    const { handler, execute } = createMockHandler();
    // Capture the downstream promise so we can assert on its rejection. Note:
    // `mock.results[].value` holds the RESOLVED value in vitest (not the
    // promise), so asserting on it with `.rejects` would fail.
    let downstream: Promise<unknown> | undefined;
    execute.mockImplementation(async (_u, _o, _k, _b, exec) => {
      downstream = exec() as Promise<unknown>;
      return downstream;
    });
    // `next` is the downstream stack: it simulates the app's error middleware
    // having already responded 500.
    const next = vi.fn(() => {
      res.statusCode = 500;
      res.headersSent = true;
      res._finishHandler?.();
    });

    const middleware = idempotencyMiddleware(handler);
    await middleware(
      req as unknown as Request,
      res as unknown as Response,
      next as unknown as NextFunction
    );

    // execute rejected (downstream 500); since the error middleware already
    // responded, the adapter must not double-send or call next(error) again.
    await expect(downstream).rejects.toThrow("Downstream handler responded with status 500");
    expect(res.json).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(ctxOf(res).outcome).toBe("failed");
  });
});
