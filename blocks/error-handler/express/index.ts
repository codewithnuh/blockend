/** @deprecated Import framework-neutral APIs from the error-handler root. */
export * from "../index.js";
export { createExpressErrorHandler } from "../adapters/express.js";
export { ERRORS } from "./errors.js";
export type { ErrorKey } from "./errors.js";
export { HTTP_STATUS } from "./http-status.js";
export type { HttpStatus } from "./http-status.js";
export { throwError } from "./throw-error.js";
export { globalErrorHandler } from "./global-error-handler.js";
export { asyncHandler } from "./async-handler.js";
