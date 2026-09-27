import { TokenError } from "../core/errors.js";

export type ProtectedAction = "issue" | "revoke";
export interface HttpAdapterOptions<Request> {
  /** Required to expose privileged issue/revoke endpoints. Return false to deny. */
  authorize?: (action: ProtectedAction, request: Request) => boolean | Promise<boolean>;
  exposeIssue?: boolean;
  exposeVerify?: boolean;
  exposeRevoke?: boolean;
}

export function statusFor(error: unknown): number {
  if (!(error instanceof TokenError)) return 500;
  if (
    error.code === "INVALID_INPUT" ||
    error.code === "CLAIMS_TOO_LARGE" ||
    error.code === "FORBIDDEN_CLAIM"
  )
    return 400;
  if (error.code === "STORE_UNAVAILABLE" || error.code === "KEY_UNAVAILABLE") return 503;
  if (error.code === "UNSUPPORTED_OPERATION") return 501;
  return 401;
}

export function errorBody(error: unknown): { error: { code: string; message: string } } {
  if (error instanceof TokenError) return { error: { code: error.code, message: error.message } };
  return { error: { code: "INTERNAL_ERROR", message: "Token operation failed" } };
}
