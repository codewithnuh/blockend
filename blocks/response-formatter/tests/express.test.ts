import { describe, test, expect } from "vitest";
import express from "express";
import type { Request, Response } from "express";
import request from "supertest";
import { ExpressResponse } from "../adapters/express.js";
import type { SuccessResponse, ErrorResponse } from "../contract.js";

describe("Formatter Block - Express Response Adapter", () => {
  describe("success()", () => {
    test("should forward data payload with default 200 status code", async () => {
      const app = express();
      const mockData = { id: 1, name: "Blockend" };

      app.get("/test-success", (_req: Request, res: Response) => {
        return ExpressResponse.success(res, mockData);
      });

      const response = await request(app).get("/test-success");

      expect(response.status).toBe(200);

      const body = response.body as SuccessResponse<typeof mockData>;
      expect(body.success).toBe(true);
      expect(body.data).toEqual(mockData);
      expect(body.message).toBe("Request completed successfully");
    });

    test("should respect custom HTTP status codes and track optional requestIds", async () => {
      const app = express();
      const mockData = { created: true };
      const traceId = "REQ-EXPRESS-SUCCESS-201";

      app.post("/test-custom", (_req: Request, res: Response) => {
        return ExpressResponse.success(res, mockData, "Resource created", 201, traceId);
      });

      const response = await request(app).post("/test-custom");

      expect(response.status).toBe(201);

      const body = response.body as SuccessResponse<typeof mockData>;
      expect(body.message).toBe("Resource created");
      expect(body.requestId).toBe(traceId);
    });
  });

  describe("paginated()", () => {
    test("should serialize calculated structural page configurations down to response body", async () => {
      const app = express();
      const mockItems = [{ id: "item-1" }];
      const paginationParams = { page: 1, limit: 5, total: 12 };

      app.get("/test-paginated", (_req: Request, res: Response) => {
        return ExpressResponse.paginated(res, mockItems, "Items slice", paginationParams);
      });

      const response = await request(app).get("/test-paginated");

      expect(response.status).toBe(200);

      const body = response.body as SuccessResponse<typeof mockItems>;
      expect(body.success).toBe(true);
      expect(body.meta).toBeDefined();
      expect(body.meta?.totalPages).toBe(3);
      expect(body.meta?.hasNext).toBe(true);
    });
  });

  describe("error()", () => {
    test("should populate correct error payload structure with provided status code", async () => {
      const app = express();
      const errorDetail = { field: "email", issue: "taken" };
      const traceId = "REQ-EXPRESS-ERR-409";

      app.get("/test-error", (_req: Request, res: Response) => {
        return ExpressResponse.error(res, 409, "Conflict error occurred", errorDetail, traceId);
      });

      const response = await request(app).get("/test-error");

      expect(response.status).toBe(409);

      const body = response.body as ErrorResponse;
      expect(body.success).toBe(false);
      expect(body.data).toBeNull();
      expect(body.requestId).toBe(traceId);
      expect(body.error).toEqual({
        message: "Conflict error occurred",
        details: errorDetail
      });
    });
  });
});
