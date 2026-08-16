import { IDEMPOTENCY_ERROR_CODES } from "../errors/codes";
import { IdempotencyError } from "../errors/idempotency-errors";
import type { IdempotencyCache } from "../interfaces/cache";
import type { Logger, Metrics } from "../interfaces/observability";
import type { CachedResponse } from "../types";
import { constantTimeEquals } from "../utils/constant-time-equals";

export const DEFAULT_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in ms

type CacheHit = { status: "HIT"; data: CachedResponse };

/**
 * L1 cache orchestration for the idempotency module.
 *
 * Responsibilities:
 *  - Build and own the cache key layout, which scopes entries per operation
 *    AND per tenant (user) so the same key used for different operations or
 *    users never collides.
 *  - Distinguish HIT / MISS / UNAVAILABLE outcomes and emit hit/miss metrics.
 *  - Enforce the hash-mismatch security check: a cache entry whose stored
 *    `request_hash` differs from the current request's hash means the key was
 *    reused with a different payload — this is an error, never a silent hit.
 *  - Keep the cache non-blocking: any underlying cache failure (e.g. Redis
 *    down) is swallowed so callers fall back to the database, which remains
 *    the source of truth.
 */
export class CacheManager {
  constructor(
    private readonly cache: IdempotencyCache | undefined,
    private readonly logger: Logger,
    private readonly metrics: Metrics
  ) {}

  /**
   * Builds a collision-free cache key.
   *
   * SECURITY INVARIANT: a naive `idem:<operation>:<userId>:<key>` join is
   * ambiguous because every component may legitimately contain the `:`
   * delimiter (key charset allows `:`, operations default to `method:path`,
   * and `getUserId` may read client-supplied headers). Two DIFFERENT scopes
   * could therefore map to the SAME cache key, letting one tenant read another
   * tenant's cached response. Length-prefixing each component makes the
   * encoding injective: the key can be decoded unambiguously, so distinct
   * scopes always produce distinct cache keys.
   */
  private buildCacheKey(userId: string, operation: string, key: string): string {
    const encode = (segment: string): string => `${segment.length}:${segment}`;

    return `idem:v1:${encode(userId)}:${encode(operation)}:${encode(key)}`;
  }

  /**
   * Reads a cached idempotent response.
   *
   * Returns the cache payload on a HIT (after verifying the request hash
   * matches), or `null` on MISS / UNAVAILABLE / no cache configured.
   *
   * SECURITY INVARIANT: on a HIT with a mismatched request hash we re-throw an
   * `IdempotencyError` — a cached success must never be returned for a
   * different payload. Only non-idempotency (infrastructure) errors are
   * swallowed so the caller can fall back to the store.
   */
  public async getCachedResponse(
    userId: string,
    operation: string,
    key: string,
    requestHash: string
  ): Promise<CacheHit | null> {
    if (!this.cache) {
      return null;
    }

    const cacheKey = this.buildCacheKey(userId, operation, key);

    try {
      const result = await this.cache.get(cacheKey);

      if (result.status === "MISS" || result.status === "UNAVAILABLE") {
        this.metrics.increment("idempotency_cache_misses_total", 1, {
          operation
        });
        this.logger.debug(
          { key, userId, operation, status: result.status },
          "Idempotency cache miss"
        );
        return null;
      }

      // SECURITY INVARIANT: never serve a cache entry whose shape is not a
      // well-formed SUCCESS payload. A corrupted, stale-format, or foreign
      // entry (wrong status, missing request_hash) must not be replayed as a
      // successful response — fall back to the store (source of truth) and
      // best-effort invalidate the bad entry.
      const data = result.data;
      if (!data || data.status !== "SUCCESS" || typeof data.request_hash !== "string") {
        this.metrics.increment("idempotency_cache_misses_total", 1, {
          operation
        });
        this.logger.warn(
          { key, userId, operation, status: data?.status },
          "Invalid cached idempotency response; falling back to store"
        );

        // Non-blocking invalidation: never let a bad cache entry break the
        // request — the DB write that produced it already succeeded.
        try {
          await this.cache.delete(cacheKey);
        } catch {
          // swallowed; the entry will expire via TTL
        }

        return null;
      }

      // Security check: Same idempotency key, but payload hash changed mid-flight
      if (!constantTimeEquals(data.request_hash, requestHash)) {
        this.logger.warn(
          { key, userId, operation },
          "Idempotency key reused with different request payload in cache"
        );
        throw new IdempotencyError(
          IDEMPOTENCY_ERROR_CODES.KEY_REUSED_WITH_DIFFERENT_REQUEST,
          "Idempotency key was already used with a different request."
        );
      }

      this.metrics.increment("idempotency_cache_hits_total", 1, { operation });
      this.logger.info({ key, userId, operation, status: "cache_hit" }, "Idempotency cache hit");
      return result;
    } catch (error) {
      // Re-throw validation/mismatch errors; swallow underlying redis/cache
      // failures so the request falls back to the database.
      if (error instanceof IdempotencyError) {
        throw error;
      }

      this.logger.error(
        {
          key,
          userId,
          operation,
          error: error instanceof Error ? error.message : error
        },
        "Error fetching idempotency record from cache"
      );
      return null;
    }
  }

  /**
   * Writes a successful response into the cache.
   *
   * NON-BLOCKING INVARIANT: the database write has already succeeded by the
   * time this runs, so a cache failure must never surface to the end user.
   * Errors are logged as warnings and swallowed.
   */
  public async setCachedResponse(
    userId: string,
    operation: string,
    key: string,
    requestHash: string,
    response: unknown
  ): Promise<void> {
    if (!this.cache) {
      return;
    }

    const cacheKey = this.buildCacheKey(userId, operation, key);

    try {
      await this.cache.set(
        cacheKey,
        {
          request_hash: requestHash,
          response,
          status: "SUCCESS"
        },
        DEFAULT_CACHE_TTL
      );
    } catch (error) {
      // Non-blocking: standard DB write succeeded, so cache failures shouldn't throw to end-user
      this.logger.warn(
        {
          key,
          userId,
          operation,
          error: error instanceof Error ? error.message : error
        },
        "Failed to update idempotency cache (database remains source of truth)"
      );
    }
  }
}
