import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { z } from "zod";

import { honoValidator, validated } from "../adapters/hono";

describe("honoValidator", () => {
  it("validates a request successfully", async () => {
    const app = new Hono();

    const bodySchema = z.object({
      name: z.string(),
      age: z.coerce.number()
    });

    app.post(
      "/users/:id",
      honoValidator({
        body: bodySchema,
        params: z.object({
          id: z.string()
        })
      }),
      (c) => {
        const data = validated<typeof bodySchema, z.ZodAny, z.ZodObject<{ id: z.ZodString }>>(c);

        return c.json(data);
      }
    );

    const res = await app.request("/users/123", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: "John",
        age: "25"
      })
    });

    expect(res.status).toBe(200);

    expect(await res.json()).toEqual({
      body: {
        name: "John",
        age: 25
      },
      query: {},
      params: {
        id: "123"
      }
    });
  });

  it("returns 400 when validation fails", async () => {
    const app = new Hono();

    app.post(
      "/",
      honoValidator({
        body: z.object({
          age: z.number()
        })
      }),
      (c) => c.text("ok")
    );

    const res = await app.request("/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        age: "not-a-number"
      })
    });

    expect(res.status).toBe(400);

    const json = await res.json();

    expect(json.success).toBe(false);
    expect(json.message).toBe("Validation failed");
    expect(json.errors).toHaveProperty("age");
  });

  it("parses query parameters", async () => {
    const app = new Hono();

    app.get(
      "/",
      honoValidator({
        query: z.object({
          page: z.coerce.number()
        })
      }),
      (c) => {
        const data = validated<z.ZodAny, z.ZodObject<{ page: z.ZodNumber }>, z.ZodAny>(c);

        return c.json(data.query);
      }
    );

    const res = await app.request("/?page=5");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      page: 5
    });
  });

  it("parses route params", async () => {
    const app = new Hono();

    app.get(
      "/users/:id",
      honoValidator({
        params: z.object({
          id: z.coerce.number()
        })
      }),
      (c) => {
        const data = validated<z.ZodAny, z.ZodAny, z.ZodObject<{ id: z.ZodNumber }>>(c);

        return c.json(data.params);
      }
    );

    const res = await app.request("/users/99");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: 99
    });
  });

  it("throws if validated() is called without middleware", async () => {
    const app = new Hono();

    app.get("/", (c) => {
      expect(() => validated(c)).toThrow("honoValidator middleware has not run");

      return c.text("ok");
    });

    const res = await app.request("/");

    expect(res.status).toBe(200);
  });
});
