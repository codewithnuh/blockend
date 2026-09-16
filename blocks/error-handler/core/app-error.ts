import type { AppErrorOptions, ErrorCategory, ErrorSeverity } from "../types/index";
import { inferCategory, inferSeverity, resolveStatusCode } from "./defaults";

export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly category: ErrorCategory;
  readonly severity: ErrorSeverity;
  readonly isOperational: boolean;
  readonly metadata?: Record<string, unknown>;
  readonly details?: unknown;

  constructor(options: AppErrorOptions);
  /** @deprecated Use the options-object constructor. */
  constructor(statusCode: number, message: string, isOperational?: boolean);
  constructor(
    optionsOrStatusCode: AppErrorOptions | number,
    legacyMessage?: string,
    legacyIsOperational?: boolean
  ) {
    const options: AppErrorOptions =
      typeof optionsOrStatusCode === "number"
        ? {
            code: "APP_ERROR",
            message: legacyMessage ?? "Application error",
            statusCode: optionsOrStatusCode,
            ...(legacyIsOperational === undefined ? {} : { isOperational: legacyIsOperational })
          }
        : optionsOrStatusCode;

    super(options.message, options.cause === undefined ? undefined : { cause: options.cause });

    const statusCode = resolveStatusCode(options.statusCode, options.category);
    this.name = "AppError";
    this.code = options.code;
    this.statusCode = statusCode;
    this.category = options.category ?? inferCategory(statusCode);
    this.severity = options.severity ?? inferSeverity(statusCode);
    this.isOperational = options.isOperational ?? statusCode < 500;
    if (options.metadata !== undefined) this.metadata = options.metadata;
    if (options.details !== undefined) this.details = options.details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
