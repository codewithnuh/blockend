// blocks/logger/tests/express.test.ts
import { describe, it, expect } from "vitest";
import express from "express"; // Resolves because framework-tester has it installed!
import request from "supertest";

// Local, relative imports to the core block code
import { getRequestId } from "../core.js";
import { expressLoggerAdapter } from "./express.js";

describe("Logger Block - Express Adapter", () => {
  it("should inject request metadata seamlessly into the execution scope", async () => {
    const app = express();
    app.use(expressLoggerAdapter);

    app.get("/test", (req, res) => {
      res.json({ id: getRequestId() });
    });

    const res = await request(app).get("/test").set("x-request-id", "BLOCK-EXP-123");
    expect(res.body.id).toBe("BLOCK-EXP-123");
  });
});
