import { describe, expect, it } from "vitest";
import { Hono } from "hono";

import { HonoResponse } from "./hono";

describe("HonoResponse", () => {
  it("returns a success response", async () => {
    const app = new Hono();

    app.get("/", (c) => HonoResponse.success(c, { id: 1 }, "Success"));

    const res = await app.request("/");

    expect(res.status).toBe(200);

    expect(await res.json()).toEqual({
      success: true,
      data: {
        id: 1
      },
      message: "Success"
    });
  });

  it("returns a paginated response", async () => {
    const app = new Hono();

    app.get("/", (c) =>
      HonoResponse.paginated(c, [{ id: 1 }], "Fetched", {
        page: 1,
        limit: 10,
        total: 1
      })
    );

    const res = await app.request("/");

    expect(res.status).toBe(200);

    expect(await res.json()).toEqual({
      success: true,
      data: [{ id: 1 }],
      message: "Fetched",
      meta: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false
      }
    });
  });

  it("returns an error response", async () => {
    const app = new Hono();

    app.get("/", (c) =>
      HonoResponse.error(c, 404, "Not Found", {
        field: "id"
      })
    );

    const res = await app.request("/");

    expect(res.status).toBe(404);

    expect(await res.json()).toEqual({
      success: false,
      data: null,
      error: {
        message: "Not Found",
        details: {
          field: "id"
        }
      }
    });
  });

  it("includes requestId when provided", async () => {
    const app = new Hono();

    app.get("/", (c) => HonoResponse.success(c, { ok: true }, "Success", 200, "req-123"));

    const res = await app.request("/");

    expect(await res.json()).toEqual({
      success: true,
      data: {
        ok: true
      },
      message: "Success",
      requestId: "req-123"
    });
  });
});
