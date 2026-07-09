import type { RateLimitRecord, RateLimitStore } from "./base.js";

export class MemoryStore implements RateLimitStore {
  private readonly store = new Map<string, RateLimitRecord>();

  public constructor() {
    // Periodically remove expired entries to prevent unbounded memory growth.
    setInterval(() => this.purge(), 5 * 60 * 1000).unref();
  }

  public increment(key: string, windowMs: number): RateLimitRecord {
    const now = Date.now();

    const existing = this.store.get(key);

    const record =
      existing && now <= existing.resetTime
        ? {
            hits: existing.hits + 1,
            resetTime: existing.resetTime
          }
        : {
            hits: 1,
            resetTime: now + windowMs
          };

    this.store.set(key, record);

    // Return a copy so callers cannot mutate the store's internal state.
    return { ...record };
  }

  private purge(): void {
    const now = Date.now();

    for (const [key, record] of this.store) {
      if (record.resetTime <= now) {
        this.store.delete(key);
      }
    }
  }
}
