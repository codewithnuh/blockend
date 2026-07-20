// --- Core Interfaces ---
export interface RateLimitRecord {
  hits: number;
  resetTime: number; // Unix timestamp in ms
}

export interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<RateLimitRecord> | RateLimitRecord;
}

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  statusCode: number;
  message: string | Record<string, unknown>;
  standardHeaders: boolean;
  legacyHeaders: boolean; // <-- Added flag for backwards compatibility
}
export interface RateLimitResult {
  isBlocked: boolean;
  statusCode: number;
  message: string | Record<string, unknown>;
  headers: Record<string, string>;
}

// --- The Core Engine ---
export async function evaluateRateLimit(
  key: string,
  store: RateLimitStore,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const { hits, resetTime } = await store.increment(key, config.windowMs);
  const remaining = Math.max(0, config.max - hits);
  const now = Date.now();

  const retryAfterSeconds = Math.ceil(Math.max(0, resetTime - now) / 1000);
  const headers: Record<string, string> = {};
  const isBlocked = hits > config.max;

  // 1. Modern Standard Headers (RFC 9421 Draft Compliant)
  if (config.standardHeaders) {
    headers["RateLimit-Limit"] = `${config.max}, window=${Math.ceil(config.windowMs / 1000)}`;
    headers["RateLimit-Remaining"] = String(remaining);
    headers["RateLimit-Reset"] = String(retryAfterSeconds); // Remaining seconds
  }

  // 2. Legacy Headers (De facto Industry Standard - GitHub, Twitter, etc.)
  if (config.legacyHeaders) {
    headers["X-RateLimit-Limit"] = String(config.max);
    headers["X-RateLimit-Remaining"] = String(remaining);
    headers["X-RateLimit-Reset"] = String(Math.ceil(resetTime / 1000)); // Absolute Unix Epoch timestamp in seconds
  }

  if (isBlocked) {
    headers["Retry-After"] = String(retryAfterSeconds);
    return {
      isBlocked: true,
      statusCode: config.statusCode,
      message: config.message,
      headers
    };
  }

  return {
    isBlocked: false,
    statusCode: 200,
    message: "",
    headers
  };
}
