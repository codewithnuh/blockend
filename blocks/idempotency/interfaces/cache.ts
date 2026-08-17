import type { CachedResponse } from "../types/index";

type CacheResult =
  | {
      status: "HIT";
      data: CachedResponse;
    }
  | {
      status: "MISS";
    }
  | {
      status: "UNAVAILABLE";
    };

export interface IdempotencyCache {
  get(key: string): Promise<CacheResult>;

  set(key: string, value: CachedResponse, ttl: number): Promise<void>;

  delete(key: string): Promise<void>;
}
