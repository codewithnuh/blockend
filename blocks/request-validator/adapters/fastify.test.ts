import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { z } from "zod";

import { fastifyValidator } from "../adapters/fastify";

describe("fastifyValidator", () => {
  it("validates the request body", async () => {
    const app = Fastify();

    const validator = fastifyValidator({
      body: z.object({
        name: z.string(),
        age: z.coerce.number()
      })
    });

    app.post("/", { preHandler: validator }, async (request) => {
      const { body } = validator.validated(request);

      return body;
    });

    const res = await app.inject({
      method: "POST",
      url: "/",
      payload: {
        name: "John",
        age: "25"
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      name: "John",
      age: 25
    });
  });

  it("validates query parameters", async () => {
    const app = Fastify();

    const validator = fastifyValidator({
      query: z.object({
        page: z.coerce.number()
      })
    });

    app.get("/", { preHandler: validator }, async (request) => {
      return validator.validated(request).query;
    });

    const res = await app.inject({
      method: "GET",
      url: "/?page=5"
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      page: 5
    });
  });

  it("validates route params", async () => {
    const app = Fastify();

    const validator = fastifyValidator({
      params: z.object({
        id: z.coerce.number()
      })
    });

    app.get("/users/:id", { preHandler: validator }, async (request) => {
      return validator.validated(request).params;
    });

    const res = await app.inject({
      method: "GET",
      url: "/users/42"
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      id: 42
    });
  });

  it("returns 400 on validation failure", async () => {
    const app = Fastify();

    const validator = fastifyValidator({
      body: z.object({
        age: z.number()
      })
    });

    app.post("/", { preHandler: validator }, async () => ({ ok: true }));

    const res = await app.inject({
      method: "POST",
      url: "/",
      payload: {
        age: "invalid"
      }
    });

    expect(res.statusCode).toBe(400);

    expect(res.json()).toMatchObject({
      success: false,
      data: null,
      message: "Validation failed"
    });
  });

  it("throws when validated() is called before middleware", async () => {
    const app = Fastify();

    const validator = fastifyValidator({
      body: z.object({
        name: z.string()
      })
    });

    app.get("/", async (request) => {
      expect(() => validator.validated(request)).toThrow("fastifyValidator has not run");

      return { ok: true };
    });

    const res = await app.inject({
      method: "GET",
      url: "/"
    });

    expect(res.statusCode).toBe(200);
  });

  it("propagates ZodError when propagateErrors is enabled", async () => {
    const app = Fastify();

    app.setErrorHandler((err, req, reply) => {
      if (err instanceof Error) {
        reply.status(500).send({
          name: err.name
        });
      }
    });

    const validator = fastifyValidator(
      {
        body: z.object({
          name: z.string()
        })
      },
      {
        propagateErrors: true
      }
    );

    app.post("/", { preHandler: validator }, async () => ({ ok: true }));

    const res = await app.inject({
      method: "POST",
      url: "/",
      payload: {}
    });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({
      name: "ZodError"
    });
  });
});
