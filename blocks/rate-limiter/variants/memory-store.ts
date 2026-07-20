import type { RateLimitRecord, RateLimitStore } from "../core/core";

interface QueueEntry {
  key: string;
  resetTime: number;
}

export class MemoryStore implements RateLimitStore {
  private readonly store = new Map<string, RateLimitRecord>();
  // High-Performance Addition: A chronological queue tracking when keys expire
  private readonly expirationQueue: QueueEntry[] = [];
  private queueIndex = 0;

  public constructor() {
    // Periodically run a bounded incremental purge instead of a full loop
    setInterval(() => this.purge(), 60 * 1000).unref();
  }

  public increment(key: string, windowMs: number): RateLimitRecord {
    const now = Date.now();
    const existing = this.store.get(key);

    // 80/20 Optimization: Inline eviction if the key is already expired
    if (existing && now > existing.resetTime) {
      this.store.delete(key);
    }

    let record: RateLimitRecord;

    if (existing && now <= existing.resetTime) {
      record = {
        hits: existing.hits + 1,
        resetTime: existing.resetTime
      };
    } else {
      record = {
        hits: 1,
        resetTime: now + windowMs
      };
      // Track this key's expiration chronologically
      this.expirationQueue.push({ key, resetTime: record.resetTime });
    }

    this.store.set(key, record);

    return { ...record };
  }

  private purge(): void {
    const now = Date.now();

    // Chronological Sweep: Since items are appended in order of expiration time,
    // we only look at the oldest items at the front of our queue.
    // The moment we hit an item that hasn't expired yet, we can STOP instantly.
    while (this.queueIndex < this.expirationQueue.length) {
      const entry = this.expirationQueue[this.queueIndex];

      if (entry.resetTime > now) {
        break; // Stop immediately. Everything after this is still valid.
      }

      // Evict from map if the current record matches this expiration mark
      const currentRecord = this.store.get(entry.key);
      if (currentRecord && currentRecord.resetTime <= now) {
        this.store.delete(entry.key);
      }

      this.queueIndex++;
    }

    // Memory clean up for the queue array itself once it grows large
    if (this.queueIndex > 10000) {
      this.expirationQueue.splice(0, this.queueIndex);
      this.queueIndex = 0;
    }
  }
}
