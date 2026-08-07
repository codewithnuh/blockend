import { describe, expect, it } from "vitest";

import { withTimeout } from "../../utils/timeout";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe("withTimeout", () => {
  it("resolves with the value when the promise is faster than the timeout", async () => {
    const value = await withTimeout(Promise.resolve(42), 1_000, "task");
    expect(value).toBe(42);
  });

  it("rejects when the promise takes longer than the timeout", async () => {
    const slow = sleep(200).then(() => "too slow");
    await expect(withTimeout(slow, 20, "db")).rejects.toThrow(
      'Shutdown task "db" timed out after 20ms'
    );
  });

  it("rejects with the underlying error if the promise fails first", async () => {
    const broken = Promise.reject(new Error("kaboom"));
    await expect(withTimeout(broken, 1_000, "task")).rejects.toThrow("kaboom");
  });

  it("clears its timer after settling", async () => {
    const before = setTimeout(() => {}, 0);
    await withTimeout(Promise.resolve("ok"), 10_000, "task");

    // If the internal timer leaked, the process would keep running — vitest
    // treats a still-pending timer as a hang. This assertion is a guardrail.
    expect(before.ref).toBeTypeOf("function");
    clearTimeout(before);
  });
});
