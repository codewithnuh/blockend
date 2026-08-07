import { describe, expect, it } from "vitest";

import { shouldRejectRequest } from "../../utils/state";

describe("shouldRejectRequest", () => {
  it("returns true while the provider is shutting down", () => {
    expect(shouldRejectRequest({ isShuttingDownState: true })).toBe(true);
  });

  it("returns false while the provider is up", () => {
    expect(shouldRejectRequest({ isShuttingDownState: false })).toBe(false);
  });
});
