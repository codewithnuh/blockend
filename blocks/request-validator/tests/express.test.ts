import { describe, test, expect } from "vitest";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import request from "supertest";
import { z, ZodError } from "zod";
import { expressValidator } from "../adapters/express.js";

describe("Validator Block - Express Adapter Engine", () => {
  test("should successfully validate, parse, and mutate the express request context", async () => {
    const userBody = z.object({
      username: z.string().min(3)
    });

    const filterQuery = z.object({
      limit: z.string().transform(Number)
    });

    const resourceParams = z.object({
      id: z.string().uuid()
    });

    const app = express();
    app.use(express.json());

    const validator = expressValidator({
      body: userBody,
      query: filterQuery,
      params: resourceParams
    });

    // Register our typed middleware on a dynamic parameter route path
    app.post("/users/:id", validator, (req: Request, res: Response) => {
      // Extract the strongly-typed returned context safely via the helper
      const validated = validator.validated(req);

      res.status(200).json({
        echoBody: req.body,
        echoQuery: req.query,
        echoParams: req.params,
        helperQueryLimitType: typeof validated.query.limit
      });
    });

    const targetUuid = "8b1feb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";

    const response = await request(app)
      .post(`/users/${targetUuid}?limit=25`)
      .send({ username: "Noor" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      echoBody: { username: "Noor" },
      echoQuery: { limit: 25 }, // Verifies coercion/transformation mutations worked on req.query
      echoParams: { id: targetUuid },
      helperQueryLimitType: "number" // Confirms Zod transform preserved types via validation helper
    });
  });

  test("should catch validation failures and format a standard 400 JSON block by default", async () => {
    const strictBody = z.object({
      email: z.string().email()
    });

    const app = express();
    app.use(express.json());

    const validator = expressValidator({ body: strictBody });

    app.post("/submit", validator, (_req: Request, res: Response) => {
      res.status(200).json({ ok: true });
    });

    const response = await request(app).post("/submit").send({ email: "invalid-email-string" });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      data: null,
      message: "Validation failed"
    });

    // Check that field-level error mappings are structured correctly
    expect(response.body.errors).toHaveProperty("email");
    expect(Array.isArray(response.body.errors.email)).toBe(true);
  });

  test("should forward ZodErrors to the downstream global handler when propagateErrors is true", async () => {
    const strictBody = z.object({
      age: z.number().min(18)
    });

    const app = express();
    app.use(express.json());

    const validator = expressValidator({ body: strictBody }, { propagateErrors: true });

    app.post("/age-check", validator, (_req: Request, res: Response) => {
      res.status(200).json({ ok: true });
    });

    // Custom global Express error-intercept handler
    app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
      if (err instanceof ZodError) {
        res.status(422).json({
          interceptorCaught: true,
          issuesCount: err.issues.length,
          firstFieldFailure: err.issues[0].path[0]
        });
        return;
      }
      res.status(500).send("Unknown Error");
    });

    const response = await request(app).post("/age-check").send({ age: 12 });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      interceptorCaught: true,
      issuesCount: 1,
      firstFieldFailure: "age"
    });
  });

  test("should throw an explosive runtime error if validated helper is triggered before middleware execution", () => {
    const dummySchema = z.object({ text: z.string() });
    const validator = expressValidator({ body: dummySchema });

    // Create a vanilla mock request simulating a handler missing its middleware initialization sequence
    const uninitializedRequest = {} as Request;

    expect(() => validator.validated(uninitializedRequest)).toThrowError(
      "[blockend] expressValidator middleware has not run for this request."
    );
  });
});
