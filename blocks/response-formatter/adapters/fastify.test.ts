import { describe, expect, it } from "vitest";
import Fastify from "fastify";

import { FastifyResponse } from "./fastify";

describe("FastifyResponse", () => {
  it("returns a success response", async () => {
    const app = Fastify();

    app.get("/", async (_, reply) => {
      return FastifyResponse.success(reply, { id: 1 }, "Success");
    });

    const res = await app.inject({
      method: "GET",
      url: "/"
    });

    expect(res.statusCode).toBe(200);

    expect(res.json()).toEqual({
      success: true,
      data: {
        id: 1
      },
      message: "Success"
    });
  });

  it("returns a paginated response", async () => {
    const app = Fastify();

    app.get("/", async (_, reply) => {
      return FastifyResponse.paginated(reply, [{ id: 1 }], "Fetched", {
        page: 1,
        limit: 10,
        total: 1
      });
    });

    const res = await app.inject({
      method: "GET",
      url: "/"
    });

    expect(res.statusCode).toBe(200);

    expect(res.json()).toEqual({
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
    const app = Fastify();

    app.get("/", async (_, reply) => {
      return FastifyResponse.error(reply, 404, "Not Found", {
        field: "id"
      });
    });

    const res = await app.inject({
      method: "GET",
      url: "/"
    });

    expect(res.statusCode).toBe(404);

    expect(res.json()).toEqual({
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
    const app = Fastify();

    app.get("/", async (_, reply) => {
      return FastifyResponse.success(reply, { ok: true }, "Success", 200, "req-123");
    });

    const res = await app.inject({
      method: "GET",
      url: "/"
    });

    expect(res.statusCode).toBe(200);

    expect(res.json()).toEqual({
      success: true,
      data: {
        ok: true
      },
      message: "Success",
      requestId: "req-123"
    });
  });
});
