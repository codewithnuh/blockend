/**
 * Thin Fastify adapter for `IdempotencyHandler`.
 *
 * The core (`core/idempotency-handler.ts` and everything it imports) is
 * deliberately framework- and package-agnostic. This file is the OPTIONAL
 * bridge that translates between Fastify requests and the handler's plain
 * typed API. It imports `fastify` only as *types*, so it has no runtime
 * dependency on Fastify.
 *
 * Usage — wrap a route whose handler either RETURNS the response payload or
 * sends it with `reply.send(...)`:
 *
 *   app.post("/payments", idempotent(handler, async (request) => {
 *     const charge = await createCharge(request.body);
 *     return { id: charge.id, status: charge.status };
 *   }));
 *
 *   // reply.send style is also captured and replayed:
 *   app.post("/payments", idempotent(handler, async (request, reply) => {
 *     reply.send(await createCharge(request.body));
 *   }));
 *
 * A single wrapper covers both styles: when the route returns a value Fastify
 * sends it; when the route calls `reply.send`, the payload is captured and
 * stored so duplicate requests replay it.
 *
 * Business-logic errors are re-thrown so Fastify's error handler can deal with
 * them; `IdempotencyError`s are mapped to HTTP status codes (see
 * `adapters/shared.ts`).
 */
import type { FastifyReply, FastifyRequest, RouteHandlerMethod } from "fastify";
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

export type FastifyIdempotencyOptions = {
  /** How to extract the key. Default: `Idempotency-Key` header only. */
  key?: IdempotencyKeySource;
  /**
   * When true, a request without a key is rejected with 400 instead of
   * silently proceeding without idempotency protection. Default: false.
   */
  requireKey?: boolean;
  /**
   * Resolve the tenant/user id. Default: `request.user?.id` or "anonymous".
   *
   * SECURITY: this value scopes the idempotency key. If it resolves to a
   * constant (e.g. the default "anonymous" when `request.user` is unset), keys
   * become GLOBAL across all users — any client that learns a key + payload
   * could replay another client's stored response. Always provide a real,
   * authenticated per-user id (or `getOperation` that embeds the tenant).
   */
  getUserId?: (request: FastifyRequest) => string | undefined;
  /** Resolve the operation name. Default: `${request.method}:${request.routerPath}`. */
  getOperation?: (request: FastifyRequest) => string;
  /** Resolve the payload to hash. Default: `request.body ?? {}`. */
  getBody?: (request: FastifyRequest) => unknown;
  /**
   * Classify business-logic failures as permanent (mark FAILED) vs transient
   * (increment retry count / release the lock). Forwarded to
   * `IdempotencyHandler.execute`.
   */
  isPermanentError?: (err: unknown) => boolean;
  /** Attach metadata to `request.idempotency`. Default: true. */
  attachContext?: boolean;
  /** Override the default `IdempotencyError` -> HTTP status mapping. */
  statusMap?: Partial<Record<IdempotencyErrorCode, number>>;
};

// Fastify module augmentation: `request.idempotency` carries the per-request
// idempotency context (key, user, operation, outcome) for observability.
declare module "fastify" {
  interface FastifyRequest {
    idempotency?: IdempotencyContext;
  }
}

/**
 * Extracts the idempotency key from a request.
 *
 * Priority: header -> JSON body field -> query parameter. The first non-empty
 * string wins; `undefined` means "no key provided". Fastify lower-cases header
 * names (Node `IncomingMessage` semantics), so the configured header is
 * compared case-insensitively.
 */
export function getIdempotencyKey(
  request: FastifyRequest,
  options: FastifyIdempotencyOptions = {}
): string | undefined {
  const { header = "Idempotency-Key", bodyField, queryParam } = options.key ?? {};

  const fromHeader = header ? request.headers[header.toLowerCase()] : undefined;
  if (typeof fromHeader === "string" && fromHeader.length > 0) {
    return fromHeader;
  }

  if (bodyField) {
    const body = request.body as Record<string, unknown> | undefined;
    const fromBody = body?.[bodyField];
    if (typeof fromBody === "string" && fromBody.length > 0) {
      return fromBody;
    }
  }

  if (queryParam) {
    const query = request.query as Record<string, unknown> | undefined;
    const fromQuery = query?.[queryParam];
    if (typeof fromQuery === "string" && fromQuery.length > 0) {
      return fromQuery;
    }
  }

  return undefined;
}

function defaultUserId(request: FastifyRequest): string {
  const user = (request as { user?: { id?: unknown } }).user;

  return typeof user?.id === "string" ? user.id : "anonymous";
}

function defaultOperation(request: FastifyRequest): string {
  // routerPath is the registered route pattern (e.g. /payments/:id), which
  // keeps the operation stable across path params and excludes the query
  // string. Fall back to the raw path if it is unavailable.
  const path = (request as { routerPath?: string }).routerPath ?? request.url.split("?")[0];

  return `${request.method}:${path}`;
}

/**
 * Wraps a route handler with idempotency protection.
 *
 * The returned Fastify handler:
 *  - extracts the key (missing key + `requireKey` -> 400, otherwise pass-through),
 *  - resolves userId/operation/body through the option hooks,
 *  - runs the business logic inside `IdempotencyHandler.execute` (which
 *    guarantees exactly-once semantics and stores the result),
 *  - returns the result so Fastify sends it — or, if the route already sent a
 *    response via `reply.send`, captures that payload for replay instead.
 */
export function idempotent(
  handler: IdempotencyHandler,
  route: (request: FastifyRequest, reply: FastifyReply) => unknown | Promise<unknown>,
  options: FastifyIdempotencyOptions = {}
): RouteHandlerMethod {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const key = getIdempotencyKey(request, options);

    if (key === undefined) {
      if (options.requireKey) {
        if (reply.sent) {
          return;
        }
        reply
          .code(400)
          .send(
            buildErrorEnvelope(
              new IdempotencyError(
                IDEMPOTENCY_ERROR_CODES.KEY_REQUIRED,
                "Missing idempotency key. Provide the configured header, body field, or query parameter."
              )
            )
          );
        return;
      }

      // No key and none required: run the business logic WITHOUT idempotency
      // protection. The route either returns a value (Fastify sends it) or
      // calls reply.send itself.
      attachContext(request, options, { outcome: "skipped" });
      return route(request, reply);
    }

    const userId = options.getUserId?.(request) ?? defaultUserId(request);
    const operation = options.getOperation?.(request) ?? defaultOperation(request);
    const body = options.getBody?.(request) ?? request.body ?? {};

    // Attach the context BEFORE executing so downstream hooks (and the route
    // itself) can read it mid-flight. The outcome is updated once the
    // execution settles.
    attachContext(request, options, {
      key,
      userId,
      operation,
      outcome: "processing"
    });

    // Capture reply.send payloads so reply.send-style routes still store their
    // response. Restored on settle so Fastify's reply stays intact.
    const originalSend = reply.send.bind(reply);
    let captured: unknown;
    let capturedOnce = false;
    reply.send = ((payload: unknown) => {
      if (!capturedOnce) {
        capturedOnce = true;
        captured = payload;
      }
      return originalSend(payload);
    }) as typeof reply.send;

    try {
      const result = await handler.execute(
        userId,
        operation,
        key,
        body,
        async () => {
          const value = await route(request, reply);
          // Prefer the route's return value; fall back to the captured
          // reply.send payload when the route responded itself.
          return value ?? captured;
        },
        options.isPermanentError ? { isPermanentError: options.isPermanentError } : undefined
      );

      attachContext(request, options, {
        key,
        userId,
        operation,
        outcome: "completed"
      });

      if (!reply.sent) {
        // Route returned a value — Fastify sends it.
        return result;
      }
      return;
    } catch (error) {
      attachContext(request, options, {
        key,
        userId,
        operation,
        outcome: "failed"
      });

      // ROBUSTNESS: if the route already sent a response before the idempotency
      // layer failed, never attempt a second send — Fastify would throw.
      if (reply.sent) {
        return;
      }

      if (error instanceof IdempotencyError) {
        reply
          .code(idempotencyErrorStatus(error, options.statusMap))
          .send(buildErrorEnvelope(error));
        return;
      }

      throw error;
    }
  };
}

function attachContext(
  request: FastifyRequest,
  options: FastifyIdempotencyOptions,
  partial: { outcome: IdempotencyContext["outcome"] } & Partial<
    Pick<IdempotencyContext, "key" | "userId" | "operation">
  >
): void {
  if (options.attachContext === false) {
    return;
  }

  const key = partial.key ?? getIdempotencyKey(request, options) ?? "";
  const userId = partial.userId ?? options.getUserId?.(request) ?? defaultUserId(request);
  const operation =
    partial.operation ?? options.getOperation?.(request) ?? defaultOperation(request);

  request.idempotency = {
    key,
    userId,
    operation,
    requestHash: hashOf(request, options),
    outcome: partial.outcome
  };
}

function hashOf(request: FastifyRequest, options: FastifyIdempotencyOptions): string {
  // The hash only feeds observability metadata on `request.idempotency`; never
  // let it break the request if the body can't be serialized.
  try {
    return hashRequest(options.getBody?.(request) ?? request.body ?? {});
  } catch {
    return "";
  }
}
