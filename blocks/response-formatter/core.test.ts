import { describe, test, expect } from "vitest";
import { ResponseFormatter } from "./core.js";
import type { SuccessResponse, ErrorResponse } from "./contract.js";

describe("Formatter Block - ResponseFormatter Engine", () => {
  describe("success()", () => {
    test("should correctly format structural success data models without optional properties", () => {
      const payload = { userId: 42, role: "admin" };

      // Explicitly cast the return value to its expected underlying branch for deep property validation
      const result = ResponseFormatter.success(
        payload,
        "User retrieved successfully"
      ) as SuccessResponse<typeof payload>;

      expect(result).toEqual({
        success: true,
        data: payload,
        message: "User retrieved successfully"
      });
      expect(result.requestId).toBeUndefined();
    });

    test("should cleanly attach tracking metadata when an optional requestId is provided", () => {
      const payload = [1, 2, 3];
      const traceId = "REQ-SUCCESS-TRACK-101";

      const result = ResponseFormatter.success(payload, "Items loaded", traceId) as SuccessResponse<
        typeof payload
      >;

      expect(result).toEqual({
        success: true,
        data: payload,
        message: "Items loaded",
        requestId: traceId
      });
    });
  });

  describe("paginated()", () => {
    test("should correctly compute standard pagination offsets and next/previous page flags", () => {
      const mockItems = [{ id: "a" }, { id: "b" }];
      const paginationInput = { page: 2, limit: 10, total: 25 };

      const result = ResponseFormatter.paginated(
        mockItems,
        "Fetched page 2",
        paginationInput,
        "REQ-PAGE-1"
      ) as SuccessResponse<typeof mockItems>;

      expect(result).toEqual({
        success: true,
        data: mockItems,
        message: "Fetched page 2",
        meta: {
          page: 2,
          limit: 10,
          total: 25,
          totalPages: 3,
          hasNext: true,
          hasPrevious: true
        },
        requestId: "REQ-PAGE-1"
      });
    });

    test("should floor unsafe negative or zero values using Math rules as an integrity firewall", () => {
      const mockItems: unknown[] = [];
      const unsafeInput = { page: -5, limit: 0, total: -100 };

      const result = ResponseFormatter.paginated(
        mockItems,
        "Edge cases",
        unsafeInput
      ) as SuccessResponse<typeof mockItems>;

      // Explicitly access the meta safely now that the compiler knows it exists on SuccessResponse
      expect(result.meta).toBeDefined();
      expect(result.meta).toEqual({
        page: 1,
        limit: 1,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrevious: false
      });
    });

    test("should evaluate pagination boolean states accurately on the boundary limits", () => {
      const mockItems = [{ id: 1 }];

      // Scenario: On the last page exactly
      const finalPageResult = ResponseFormatter.paginated(mockItems, "Page 3", {
        page: 3,
        limit: 5,
        total: 15
      }) as SuccessResponse<typeof mockItems>;
      expect(finalPageResult.meta?.hasNext).toBe(false);
      expect(finalPageResult.meta?.hasPrevious).toBe(true);

      // Scenario: Empty table payload configurations
      const emptyResult = ResponseFormatter.paginated([], "Empty list", {
        page: 1,
        limit: 10,
        total: 0
      }) as SuccessResponse<never[]>;
      expect(emptyResult.meta?.totalPages).toBe(0);
      expect(emptyResult.meta?.hasNext).toBe(false);
      expect(emptyResult.meta?.hasPrevious).toBe(false);
    });
  });

  describe("error()", () => {
    test("should capture structural error details and safely map error payload elements", () => {
      const errorContent = {
        message: "Database connection timed out",
        details: { driverCode: "ETIMEDOUT", attempt: 3 }
      };

      // Uses ErrorResponse contract signature completely
      const result: ErrorResponse = ResponseFormatter.error(errorContent, "REQ-ERR-500");

      expect(result).toEqual({
        success: false,
        data: null,
        error: errorContent,
        requestId: "REQ-ERR-500"
      });
      expect(result.error.details).toHaveProperty("driverCode", "ETIMEDOUT");
    });
  });
});
