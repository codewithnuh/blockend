import { Request, Response, NextFunction } from "express";
import { z, ZodError } from "zod";

import { AppError } from "./app-error.js";
import { HTTP_STATUS } from "./http-status.js";
import { ERRORS } from "./errors.js";

/**
 * Express error-handling middleware. Register this LAST, after all routes
 * and other middleware — Express identifies error handlers by their
 * 4-argument signature, and only calls the first one that matches.
 *
 * app.use(globalErrorHandler)
 */
export const globalErrorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) => {
  // -------------------------
  // Custom AppError — expected, operational errors
  // -------------------------
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      data: null,
      message: err.message
    });
  }

  // -------------------------
  // Zod validation error
  // -------------------------
  if (err instanceof ZodError) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      data: null,
      message: ERRORS.VALIDATION_FAILED.message,
      errors: z.treeifyError(err)
    });
  }

  // -------------------------
  // Unknown / unhandled errors — never leak details to the client
  // -------------------------
  logUnhandledError(err, req);

  return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
    success: false,
    data: null,
    message: ERRORS.INTERNAL_SERVER_ERROR.message
  });
};

/**
 * Single seam for unhandled-error logging. Swap this out for a
 * structured logger (e.g. Blockend's `logger` block) without touching
 * the control flow above.
 */
function logUnhandledError(err: unknown, req: Request): void {
  // eslint-disable-next-line no-console
  console.error("[UNHANDLED ERROR]", {
    method: req.method,
    path: req.path,
    error: err
  });
}
