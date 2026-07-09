import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryStore } from "../store-memory";
describe("Rate Limiter Block - MemoryStore Engine", () => {
  beforeEach(() => {
    // Lock system clocks inside a virtual environment before running state tracking tests
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Clean up timers and restore standard runtime behavior
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  test("should initialize a new key record on first increment call", () => {
    const memoryStore = new MemoryStore();
    const startTime = Date.now();
    const windowMs = 60 * 1000;

    const result = memoryStore.increment("client_ip_1", windowMs);

    expect(result).toEqual({
      hits: 1,
      resetTime: startTime + windowMs
    });
  });

  test("should accumulate hit counts sequentially for non-expired active window keys", () => {
    const memoryStore = new MemoryStore();
    const windowMs = 30 * 1000;

    memoryStore.increment("client_ip_2", windowMs);
    const stepTwo = memoryStore.increment("client_ip_2", windowMs);
    const stepThree = memoryStore.increment("client_ip_2", windowMs);

    expect(stepTwo.hits).toBe(2);
    expect(stepThree.hits).toBe(3);
  });

  test("should automatically reset the window mapping structure once the expiration time passes", () => {
    const memoryStore = new MemoryStore();
    const windowMs = 10 * 1000; // 10 seconds tracking window

    memoryStore.increment("client_ip_3", windowMs);
    memoryStore.increment("client_ip_3", windowMs);

    // Fast-forward system time by 11 seconds to cross the tracking delta limit threshold boundary
    vi.advanceTimersByTime(11 * 1000);

    const postExpiryRecord = memoryStore.increment("client_ip_3", windowMs);

    // The hits counter should reset gracefully back down to 1
    expect(postExpiryRecord.hits).toBe(1);
    expect(postExpiryRecord.resetTime).toBe(Date.now() + windowMs);
  });

  test("should efficiently run background garbage collection to evict expired cache entries", () => {
    const memoryStore = new MemoryStore();
    const windowMs = 60 * 1000; // 1 minute window

    memoryStore.increment("stale_key", windowMs);
    memoryStore.increment("fresh_key", windowMs * 10); // Extends further out

    // 1. Check current size state safely via private variable string indexing
    // This allows us to inspect internal structures without mutating or casting to 'any'
    const internalMap = (memoryStore as unknown as { store: Map<string, unknown> }).store;
    expect(internalMap.size).toBe(2);

    // 2. Advance time past the 1-minute expiration of 'stale_key' but right up to the 5-minute interval mark
    vi.advanceTimersByTime(5 * 60 * 1000);

    // 3. The 5-minute garbage collection purge interval has now fired natively!
    // The expired record should be cleanly dropped, while the valid record stays intact
    expect(internalMap.size).toBe(1);
    expect(internalMap.has("stale_key")).toBe(false);
    expect(internalMap.has("fresh_key")).toBe(true);
  });
});
