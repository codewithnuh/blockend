/**
 * Thin Express adapter for `IdempotencyHandler`.
 *
 * The core (`core/idempotency-handler.ts` and everything it imports) is deliberately
 * framework- and package-agnostic — it only depends on Node built-ins. This
 * file is the OPTIONAL bridge that translates between Express requests and the
 * handler's plain-typed API. It imports `express` only as *types*, so it has
 * no runtime dependency on Express either.
 *
 * Two usage styles are provided:
 *
 * 1. `idempotent(handler, route, options)` — wrap a route whose business logic
 *    RETURNS the response payload. Cleanest and fully typed:
 *
 *        app.post("/payments", idempotent(handler, async (req) => {
 *          const charge = await createCharge(req.body);
 *          return { id: charge.id, status: charge.status };
 *        }));
 *
 * 2. `idempotencyMiddleware(handler, options)` — drop-in middleware for routes
 *    that already call `res.json(...)` themselves. The middleware intercepts
 *    the JSON body the downstream handler sends and stores it as the
 *    idempotent response:
 *
 *        app.post("/payments", idempotencyMiddleware(handler), async (req, res) => {
 *          const charge = await createCharge(req.body);
 *          res.json(charge);
 *        });
 *
 * Both styles forward business-logic errors to Express's error middleware and
 * map `IdempotencyError`s to HTTP status codes (see `idempotencyErrorStatus`).
 */
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { IDEMPOTENCY_ERROR_CODES } from "../errors/codes";
import type { IdempotencyErrorCode } from "../errors/codes";
import { IdempotencyError } from "../errors/idempotency-errors";
import type { IdempotencyHandler } from "../core/idempotency-handler";
import { hashRequest } from "../utils/serializer";
import { buildErrorEnvelope, idempotencyErrorStatus } from "./shared";

// Re-exported for API parity — the mapping is shared by every framework adapter.
export { idempotencyErrorStatus } from "./shared";

/** Where to look for the idempotency key in a request. */
export type IdempotencyKeySource = {
  /** Header name (e.g. "Idempotency-Key"). Default: "Idempotency-Key". */
  header?: string;
  /** Optional JSON body field (e.g. "idempotencyKey"). Disabled by default. */
  bodyField?: string;
  /** Optional query parameter (e.g. "idempotency_key"). Disabled by default. */
  queryParam?: string;
};

export type IdempotencyContext = {
  key: string;
  userId: string;
  operation: string;
  requestHash: string;
  outcome: "processing" | "completed" | "failed" | "skipped";
};

export type ExpressIdempotencyOptions = {
  /** How to extract the key. Default: `Idempotency-Key` header only. */
  key?: IdempotencyKeySource;
  /**
   * When true, a request without a key is rejected with 400 instead of
   * silently proceeding without idempotency protection. Default: false.
   */
  requireKey?: boolean;
  /**
   * Resolve the tenant/user id. Default: `req.user?.id` or "anonymous".
   *
   * SECURITY: this value scopes the idempotency key. If it resolves to a
   * constant (e.g. the default "anonymous" when `req.user` is unset), keys
   * become GLOBAL across all users — any client that learns a key + payload
   * could replay another client's stored response. Always provide a real,
   * authenticated per-user id (or `getOperation` that embeds the tenant).
   */
  getUserId?: (req: Request) => string | undefined;
  /** Resolve the operation name. Default: `${req.method}:${req.path}`. */
  getOperation?: (req: Request) => string;
  /** Resolve the payload to hash. Default: `req.body ?? {}`. */
  getBody?: (req: Request) => unknown;
  /**
   * Classify business-logic failures as permanent (mark FAILED) vs transient
   * (increment retry count / release the lock). Forwarded to
   * `IdempotencyHandler.execute`.
   */
  isPermanentError?: (err: unknown) => boolean;
  /** Attach metadata to `res.locals.idempotency`. Default: true. */
  attachContext?: boolean;
  /** Override the default `IdempotencyError` -> HTTP status mapping. */
  statusMap?: Partial<Record<IdempotencyErrorCode, number>>;
};

/**
 * Extracts the idempotency key from a request.
 *
 * Priority: header -> JSON body field -> query parameter. The first non-empty
 * string wins; `undefined` means "no key provided".
 */
export function getIdempotencyKey(
  req: Request,
  options: ExpressIdempotencyOptions = {}
): string | undefined {
  const { header = "Idempotency-Key", bodyField, queryParam } = options.key ?? {};

  const fromHeader = header ? req.get(header) : undefined;
  if (typeof fromHeader === "string" && fromHeader.length > 0) {
    return fromHeader;
  }

  if (bodyField) {
    const body = req.body as Record<string, unknown> | undefined;
    const fromBody = body?.[bodyField];
    if (typeof fromBody === "string" && fromBody.length > 0) {
      return fromBody;
    }
  }

  if (queryParam) {
    const fromQuery = req.query[queryParam];
    if (typeof fromQuery === "string" && fromQuery.length > 0) {
      return fromQuery;
    }
  }

  return undefined;
}

/**
 * Responds with the standard error envelope: `{ error: { code, message } }`.
 */
export function sendIdempotencyError(
  res: Response,
  error: IdempotencyError,
  statusMap?: ExpressIdempotencyOptions["statusMap"]
): void {
  res.status(idempotencyErrorStatus(error, statusMap)).json(buildErrorEnvelope(error));
}

function defaultUserId(req: Request): string {
  const user = (req as { user?: { id?: unknown } }).user;

  return typeof user?.id === "string" ? user.id : "anonymous";
}

function defaultOperation(req: Request): string {
  return `${req.method}:${req.path}`;
}

/**
 * Wraps a route handler that RETURNS its response payload.
 *
 * The returned Express handler:
 *  - extracts the key (missing key + `requireKey` -> 400, otherwise pass-through),
 *  - resolves userId/operation/body through the option hooks,
 *  - runs the business logic inside `IdempotencyHandler.execute` (which
 *    guarantees exactly-once semantics and stores the returned value),
 *  - sends the result with `res.json(result)` unless the route already
 *    responded.
 */
export function idempotent(
  handler: IdempotencyHandler,
  route: (req: Request, res: Response) => unknown | Promise<unknown>,
  options: ExpressIdempotencyOptions = {}
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = getIdempotencyKey(req, options);

    if (key === undefined) {
      if (options.requireKey) {
        if (res.headersSent) {
          return;
        }
        sendIdempotencyError(
          res,
          new IdempotencyError(
            IDEMPOTENCY_ERROR_CODES.KEY_REQUIRED,
            "Missing idempotency key. Provide the configured header, body field, or query parameter."
          ),
          options.statusMap
        );
        return;
      }

      // No key and none required: run the business logic WITHOUT idempotency
      // protection. In this wrapper style the route IS the downstream handler,
      // so we invoke it directly (calling next() would skip it entirely).
      attachContext(req, res, options, { outcome: "skipped" });
      const unguarded = await route(req, res);
      if (!res.headersSent) {
        res.json(unguarded);
      }
      return;
    }

    const userId = options.getUserId?.(req) ?? defaultUserId(req);
    const operation = options.getOperation?.(req) ?? defaultOperation(req);
    const body = options.getBody?.(req) ?? req.body ?? {};

    // Attach the context BEFORE executing so downstream middleware (including
    // the route itself and error middleware) can read it mid-flight. The
    // outcome is updated once the execution settles.
    attachContext(req, res, options, {
      key,
      userId,
      operation,
      outcome: "processing"
    });

    try {
      const result = await handler.execute(
        userId,
        operation,
        key,
        body,
        // `async` wraps the route's (possibly plain) return value in a promise,
        // satisfying the handler's `() => Promise<unknown>` callback contract.
        async () => route(req, res),
        options.isPermanentError ? { isPermanentError: options.isPermanentError } : undefined
      );

      attachContext(req, res, options, {
        key,
        userId,
        operation,
        outcome: "completed"
      });

      if (!res.headersSent) {
        res.json(result);
      }
    } catch (error) {
      attachContext(req, res, options, {
        key,
        userId,
        operation,
        outcome: "failed"
      });

      // SECURITY/ROBUSTNESS: if the route already sent a response before the
      // idempotency layer failed, never attempt a second send — Express would
      // throw "Cannot set headers after they are sent" and crash the request.
      if (res.headersSent) {
        return;
      }

      if (error instanceof IdempotencyError) {
        sendIdempotencyError(res, error, options.statusMap);
        return;
      }

      next(error);
    }
  };
}

/**
 * Drop-in middleware for routes that send their own response.
 *
 * The downstream handler's `res.json`/`res.send` payload is captured and stored
 * as the idempotent response. If the downstream chain errors (a 4xx/5xx
 * response, e.g. from your error middleware), the idempotency record is marked
 * FAILED instead of SUCCESS, and the error is NOT re-sent — your error
 * middleware already handled it.
 */
export function idempotencyMiddleware(
  handler: IdempotencyHandler,
  options: ExpressIdempotencyOptions = {}
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = getIdempotencyKey(req, options);

    if (key === undefined) {
      if (options.requireKey) {
        sendIdempotencyError(
          res,
          new IdempotencyError(
            IDEMPOTENCY_ERROR_CODES.KEY_REQUIRED,
            "Missing idempotency key. Provide the configured header, body field, or query parameter."
          ),
          options.statusMap
        );
        return;
      }

      attachContext(req, res, options, { outcome: "skipped" });
      next();
      return;
    }

    const userId = options.getUserId?.(req) ?? defaultUserId(req);
    const operation = options.getOperation?.(req) ?? defaultOperation(req);
    const body = options.getBody?.(req) ?? req.body ?? {};

    // Attach the context BEFORE executing so downstream middleware can read it
    // mid-flight. The outcome is updated once the execution settles.
    attachContext(req, res, options, {
      key,
      userId,
      operation,
      outcome: "processing"
    });

    try {
      const result = await handler.execute(
        userId,
        operation,
        key,
        body,
        () => runDownstream(req, res, next),
        options.isPermanentError ? { isPermanentError: options.isPermanentError } : undefined
      );

      attachContext(req, res, options, {
        key,
        userId,
        operation,
        outcome: "completed"
      });

      // The downstream handler already sent its response; only send if it
      // produced no payload.
      if (!res.headersSent) {
        res.json(result);
      }
    } catch (error) {
      attachContext(req, res, options, {
        key,
        userId,
        operation,
        outcome: "failed"
      });

      // The downstream error middleware already responded — don't double-send.
      if (res.headersSent) {
        return;
      }

      if (error instanceof IdempotencyError) {
        sendIdempotencyError(res, error, options.statusMap);
        return;
      }

      next(error);
    }
  };
}

function attachContext(
  req: Request,
  res: Response,
  options: ExpressIdempotencyOptions,
  partial: { outcome: IdempotencyContext["outcome"] } & Partial<
    Pick<IdempotencyContext, "key" | "userId" | "operation">
  >
): void {
  if (options.attachContext === false) {
    return;
  }

  const key = partial.key ?? getIdempotencyKey(req, options) ?? "";
  const userId = partial.userId ?? options.getUserId?.(req) ?? defaultUserId(req);
  const operation = partial.operation ?? options.getOperation?.(req) ?? defaultOperation(req);

  res.locals.idempotency = {
    key,
    userId,
    operation,
    requestHash: hashOf(req, options),
    outcome: partial.outcome
  };
}

function hashOf(req: Request, options: ExpressIdempotencyOptions): string {
  // The hash only feeds observability metadata on `res.locals`; never let it
  // break the request if the body can't be serialized.
  try {
    return hashRequest(options.getBody?.(req) ?? req.body ?? {});
  } catch {
    return "";
  }
}

/**
 * Runs the downstream Express stack, resolving with the JSON payload the route
 * sends via `res.json`/`res.send`.
 */
function runDownstream(req: Request, res: Response, next: NextFunction): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let captured: unknown;
    let settled = false;

    // Keep the RAW references for restoration so any spies/mocks installed on
    // the response stay inspectable; use the bound versions for invoking (so
    // `this` remains the response object, as Express expects).
    const rawJson = res.json;
    const rawSend = res.send;
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    const settle = (value: unknown): void => {
      if (!settled) {
        settled = true;
        res.json = rawJson;
        res.send = rawSend;
        resolve(value);
      }
    };
    const fail = (err: unknown): void => {
      if (!settled) {
        settled = true;
        res.json = rawJson;
        res.send = rawSend;
        reject(err);
      }
    };

    // Any 4xx/5xx response — including one sent by the app's error middleware
    // via res.json/res.send — means the downstream execution FAILED. Check the
    // status at capture time so an error body is never recorded as a success.
    const respond = (value: unknown): void => {
      if (res.statusCode >= 400) {
        fail(new Error(`Downstream handler responded with status ${res.statusCode}`));
      } else {
        settle(value);
      }
    };

    res.json = (value: unknown) => {
      captured = value;
      respond(value);
      return originalJson(value);
    };
    res.send = (value: unknown) => {
      captured = value;
      respond(value);
      return originalSend(value);
    };

    res.once("finish", () => {
      // If the downstream chain errored, the app's error middleware typically
      // responds with 4xx/5xx. Treat that as a failed execution so the
      // idempotency record is marked FAILED rather than SUCCESS.
      if (res.statusCode >= 400) {
        fail(new Error(`Downstream handler responded with status ${res.statusCode}`));
      } else {
        settle(captured);
      }
    });

    next();
  });
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Locals {
      idempotency?: IdempotencyContext;
    }
  }
}
