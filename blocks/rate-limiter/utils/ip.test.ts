import { describe, expect, it } from "vitest";
import { getClientIp } from "./ip";

describe("getClientIp", () => {
  it("prefers the first x-forwarded-for address and trims proxy whitespace", () => {
    const ip = getClientIp(
      {
        "x-forwarded-for": "203.0.113.10, 198.51.100.20"
      },
      "10.0.0.1"
    );

    expect(ip).toBe("203.0.113.10");
  });

  it("supports array x-forwarded-for headers from Node adapters", () => {
    const ip = getClientIp({
      "x-forwarded-for": [" 2001:db8::1, 10.0.0.2"]
    });

    expect(ip).toBe("2001:db8::1");
  });

  it("falls back to x-real-ip, then socket address, then a stable unknown key", () => {
    expect(getClientIp({ "x-real-ip": "198.51.100.7" }, "10.0.0.1")).toBe("198.51.100.7");
    expect(getClientIp({}, "10.0.0.1")).toBe("10.0.0.1");
    expect(getClientIp({})).toBe("unknown-ip");
  });
});
