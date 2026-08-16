/**
 * Thin Hono adapter for `IdempotencyHandler`.
 *
 * The core (`core/idempotency-handler.ts` and everything it imports) is
 * deliberately framework- and package-agnostic. This file is the OPTIONAL
 * bridge that translates between Hono contexts and the handler's plain typed
 * API. It imports `hono` only as *types*, so it has no runtime dependency on
 * Hono.
 *
 * Two usage styles are provided:
 *
 * 1. `idempotent(handler, route, options)` — wrap a route whose handler
 *    RETURNS the response payload (or a `Response`). Cleanest and fully typed:
 *
 *        app.post("/payments", idempotent(handler, async (c) => {
 *          const charge = await createCharge(await c.req.json());
 *          return { id: charge.id, status: charge.status };
 *        }));
 *
 * 2. `idempotencyMiddleware(handler, options)` — drop-in middleware for routes
 *    that already send their own response with `c.json(...)`. The middleware
 *    captures the JSON body the route produced and stores it as the idempotent
 *    response:
 *
 *        app.post("/payments", idempotencyMiddleware(handler), async (c) => {
 *          const charge = await createCharge(await c.req.json());
 *          return c.json(charge);
 *        });
 *
 * Both styles forward business-logic errors to Hono's error handler and map
 * `IdempotencyError`s to HTTP status codes (see `adapters/shared.ts`).
 *
 * BODY READING: the payload is hashed from a CLONE of the request body
 * (`c.req.raw.clone()`), so the downstream route can still call
 * `await c.req.json()` — the clone never consumes the original stream.
 */
import type { Context, MiddlewareHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { IDEMPOTENCY_ERROR_CODES } from "../errors/codes";
import type { IdempotencyErrorCode } from "../errors/codes";
import { IdempotencyError } from "../errors/idempotency-errors";
import type { IdempotencyHandler } from "../core/idempotency-handler";
import { hashRequest } from "../utils/serializer";
import { buildErrorEnvelope, idempotencyErrorStatus } from "./shared";

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

export type HonoIdempotencyOptions = {
  /** How to extract the key. Default: `Idempotency-Key` header only. */
  key?: IdempotencyKeySource;
  /**
   * When true, a request without a key is rejected with 400 instead of
   * silently proceeding without idempotency protection. Default: false.
   */
  requireKey?: boolean;
  /**
   * Resolve the tenant/user id. Default: `c.get("user")?.id` or "anonymous".
   *
   * SECURITY: this value scopes the idempotency key. If it resolves to a
   * constant (e.g. the default "anonymous" when no user is set), keys become
   * GLOBAL across all users — any client that learns a key + payload could
   * replay another client's stored response. Always provide a real,
   * authenticated per-user id (or `getOperation` that embeds the tenant).
   */
  getUserId?: (c: Context) => string | undefined;
  /** Resolve the operation name. Default: `${c.req.method}:${c.req.path}`. */
  getOperation?: (c: Context) => string;
  /**
   * Resolve the payload to hash. May be async. Default: the parsed JSON body,
   * read from a non-consuming clone of the request.
   */
  getBody?: (c: Context) => unknown | Promise<unknown>;
  /**
   * Classify business-logic failures as permanent (mark FAILED) vs transient
   * (increment retry count / release the lock). Forwarded to
   * `IdempotencyHandler.execute`.
   */
  isPermanentError?: (err: unknown) => boolean;
  /**
   * Attach metadata to the Hono context (`c.get("idempotency")`). Default:
   * true.
   */
  attachContext?: boolean;
  /** Override the default `IdempotencyError` -> HTTP status mapping. */
  statusMap?: Partial<Record<IdempotencyErrorCode, number>>;
};

const IDEMPOTENCY_CONTEXT_KEY = "blockend.idempotency";

/**
 * Reads the JSON body from a non-consuming clone of the request, so the
 * downstream handler can still call `c.req.json()`. Returns `{}` when the body
 * is not JSON (or absent).
 */
export async function readJsonBody(c: Context): Promise<unknown> {
  try {
    return await c.req.raw.clone().json();
  } catch {
    return {};
  }
}

/**
 * Extracts the idempotency key from a request.
 *
 * Priority: header -> query parameter -> JSON body field. The first non-empty
 * string wins; `undefined` means "no key provided". Async because reading a
 * body-field key requires reading the (cloned) request body.
 */
export async function getIdempotencyKey(
  c: Context,
  options: HonoIdempotencyOptions = {}
): Promise<string | undefined> {
  const { header = "Idempotency-Key", bodyField, queryParam } = options.key ?? {};

  const fromHeader = header ? c.req.header(header) : undefined;
  if (typeof fromHeader === "string" && fromHeader.length > 0) {
    return fromHeader;
  }

  if (queryParam) {
    const fromQuery = c.req.query(queryParam);
    if (typeof fromQuery === "string" && fromQuery.length > 0) {
      return fromQuery;
    }
  }

  if (bodyField) {
    const body = (await readJsonBody(c)) as Record<string, unknown> | undefined;
    const fromBody = body?.[bodyField];
    if (typeof fromBody === "string" && fromBody.length > 0) {
      return fromBody;
    }
  }

  return undefined;
}

/**
 * Reads the context attached by the adapters (when `attachContext` is true).
 * Returns `undefined` when no idempotency middleware/wrapper ran.
 */
export function getIdempotencyContext(c: Context): IdempotencyContext | undefined {
  return c.get(IDEMPOTENCY_CONTEXT_KEY) as IdempotencyContext | undefined;
}

function defaultUserId(c: Context): string {
  const user = c.get("user") as { id?: unknown } | undefined;

  return typeof user?.id === "string" ? user.id : "anonymous";
}

function defaultOperation(c: Context): string {
  return `${c.req.method}:${c.req.path}`;
}

function sendIdempotencyError(
  c: Context,
  error: IdempotencyError,
  options: HonoIdempotencyOptions
): Response {
  return c.json(
    buildErrorEnvelope(error),
    idempotencyErrorStatus(error, options.statusMap) as ContentfulStatusCode
  );
}

/**
 * Wraps a route handler with idempotency protection.
 *
 * The route returns the response payload (sent with `c.json`) or an already
 * built `Response`. The returned middleware:
 *  - extracts the key (missing key + `requireKey` -> 400, otherwise pass-through),
 *  - resolves userId/operation/body through the option hooks,
 *  - runs the business logic inside `IdempotencyHandler.execute` (which
 *    guarantees exactly-once semantics and stores the returned value),
 *  - sends the result.
 */
export function idempotent(
  handler: IdempotencyHandler,
  route: (c: Context) => unknown | Response | Promise<unknown | Response>,
  options: HonoIdempotencyOptions = {}
): MiddlewareHandler {
  return async (c: Context) => {
    const key = await getIdempotencyKey(c, options);

    if (key === undefined) {
      if (options.requireKey) {
        return sendIdempotencyError(
          c,
          new IdempotencyError(
            IDEMPOTENCY_ERROR_CODES.KEY_REQUIRED,
            "Missing idempotency key. Provide the configured header, body field, or query parameter."
          ),
          options
        );
      }

      // No key and none required: run the business logic WITHOUT idempotency
      // protection.
      await attachContext(c, options, { outcome: "skipped" });
      const unguarded = await route(c);
      return unguarded instanceof Response ? unguarded : c.json(unguarded);
    }

    const userId = options.getUserId?.(c) ?? defaultUserId(c);
    const operation = options.getOperation?.(c) ?? defaultOperation(c);
    const body = (await options.getBody?.(c)) ?? (await readJsonBody(c));

    // Attach the context BEFORE executing so the route (which runs inside
    // `handler.execute`) can read the key / user / operation mid-flight. The
    // outcome is updated once the execution settles.
    await attachContext(c, options, {
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
        async () => route(c),
        options.isPermanentError ? { isPermanentError: options.isPermanentError } : undefined
      );

      await attachContext(c, options, {
        key,
        userId,
        operation,
        outcome: "completed"
      });

      return result instanceof Response ? result : c.json(result);
    } catch (error) {
      await attachContext(c, options, {
        key,
        userId,
        operation,
        outcome: "failed"
      });

      if (error instanceof IdempotencyError) {
        return sendIdempotencyError(c, error, options);
      }

      throw error;
    }
  };
}

/**
 * Drop-in middleware for routes that send their own response.
 *
 * Register with `app.use("/path", idempotencyMiddleware(handler))` or on a
 * single route. The downstream handler's `c.json` payload is captured and
 * stored as the idempotent response. If the downstream chain errors (a 4xx/5xx
 * response or a thrown error), the idempotency record is marked FAILED and the
 * error response is left untouched.
 */
export function idempotencyMiddleware(
  handler: IdempotencyHandler,
  options: HonoIdempotencyOptions = {}
): MiddlewareHandler {
  return async (c: Context, next) => {
    const key = await getIdempotencyKey(c, options);

    if (key === undefined) {
      if (options.requireKey) {
        return sendIdempotencyError(
          c,
          new IdempotencyError(
            IDEMPOTENCY_ERROR_CODES.KEY_REQUIRED,
            "Missing idempotency key. Provide the configured header, body field, or query parameter."
          ),
          options
        );
      }

      await attachContext(c, options, { outcome: "skipped" });
      return next();
    }

    const userId = options.getUserId?.(c) ?? defaultUserId(c);
    const operation = options.getOperation?.(c) ?? defaultOperation(c);
    const body = (await options.getBody?.(c)) ?? (await readJsonBody(c));

    // Attach the context BEFORE executing so the route can read it mid-flight.
    await attachContext(c, options, {
      key,
      userId,
      operation,
      outcome: "processing"
    });

    // `c.res` is ALWAYS truthy in Hono (the getter synthesizes a default 200
    // Response from context state), so "did the route already respond?" cannot
    // be answered by checking `c.res`. Instead we record whether the downstream
    // chain actually ran and produced a real response.
    let downstreamRes: Response | undefined;

    let result: unknown;

    try {
      result = await handler.execute(
        userId,
        operation,
        key,
        body,
        async () => {
          // Run the downstream chain; the route sets `c.res`.
          await next();
          downstreamRes = c.res;

          if (!downstreamRes) {
            throw new Error("No response produced by the downstream handler.");
          }

          // Any 4xx/5xx response — including one sent by the app's error
          // handler — means the downstream execution FAILED. An error body must
          // never be recorded as a success.
          if (downstreamRes.status >= 400) {
            throw new Error(`Downstream handler responded with status ${downstreamRes.status}`);
          }

          return capturePayload(downstreamRes);
        },
        options.isPermanentError ? { isPermanentError: options.isPermanentError } : undefined
      );

      await attachContext(c, options, {
        key,
        userId,
        operation,
        outcome: "completed"
      });

      // The route already produced the response — let it through. On a cache
      // hit or store replay the route never ran, so send the stored result
      // instead.
      return downstreamRes ?? c.json(result);
    } catch (error) {
      await attachContext(c, options, {
        key,
        userId,
        operation,
        outcome: "failed"
      });

      // ROBUSTNESS: if the downstream chain already produced a response (its
      // own 4xx/5xx, or a success that failed to record afterwards), never
      // replace it — return the real response the route produced.
      if (downstreamRes) {
        return downstreamRes;
      }

      if (error instanceof IdempotencyError) {
        return sendIdempotencyError(c, error, options);
      }

      // The downstream route threw — let Hono's error handler respond.
      throw error;
    }
  };
}

/**
 * Reads the payload of a successful response without disturbing it. Tries JSON
 * first, then falls back to raw text for non-JSON bodies.
 */
async function capturePayload(res: Response): Promise<unknown> {
  const clone = res.clone();

  try {
    return await clone.json();
  } catch {
    return await clone.text();
  }
}

async function attachContext(
  c: Context,
  options: HonoIdempotencyOptions,
  partial: { outcome: IdempotencyContext["outcome"] } & Partial<
    Pick<IdempotencyContext, "key" | "userId" | "operation">
  >
): Promise<void> {
  if (options.attachContext === false) {
    return;
  }

  const key = partial.key ?? ""; // key is always known by attach time
  const userId = partial.userId ?? options.getUserId?.(c) ?? defaultUserId(c);
  const operation = partial.operation ?? options.getOperation?.(c) ?? defaultOperation(c);

  c.set(IDEMPOTENCY_CONTEXT_KEY, {
    key,
    userId,
    operation,
    requestHash: await hashOf(c, options),
    outcome: partial.outcome
  } satisfies IdempotencyContext);
}

async function hashOf(c: Context, options: HonoIdempotencyOptions): Promise<string> {
  // The hash only feeds observability metadata on the context; never let it
  // break the request if the body can't be serialized.
  try {
    const body = (await options.getBody?.(c)) ?? (await readJsonBody(c));
    return hashRequest(body);
  } catch {
    return "";
  }
}
