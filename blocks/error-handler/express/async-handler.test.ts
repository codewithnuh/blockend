import { describe, expect, it } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { asyncHandler } from "./async-handler";

function createNextCollector(): { next: NextFunction; calls: unknown[] } {
  const calls: unknown[] = [];
  const next: NextFunction = ((error?: unknown) => {
    calls.push(error);
  }) as NextFunction;

  return { next, calls };
}

describe("asyncHandler", () => {
  it("forwards rejected route promises to next", async () => {
    const thrown = new Error("database unavailable");
    const { next, calls } = createNextCollector();

    const wrapped = asyncHandler(async () => {
      throw thrown;
    });

    wrapped({} as Request, {} as Response, next);
    await Promise.resolve();

    expect(calls).toEqual([thrown]);
  });

  it("does not call next when the route resolves successfully", async () => {
    const { next, calls } = createNextCollector();
    const response = { locals: {} } as Response;

    const wrapped = asyncHandler(async (_req: Request, res: Response) => {
      res.locals.completed = true;
    });

    wrapped({} as Request, response, next);
    await Promise.resolve();

    expect(response.locals.completed).toBe(true);
    expect(calls).toEqual([]);
  });
});
