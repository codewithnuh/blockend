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

export function requireObjectBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new TokenError("INVALID_INPUT", "Expected a JSON object request body");
  return value as Record<string, unknown>;
}

export function requireStringField(body: unknown, field: string): string {
  const value = requireObjectBody(body)[field];
  if (typeof value !== "string" || value.length === 0)
    throw new TokenError("INVALID_INPUT", `Expected ${field} to be a non-empty string`);
  return value;
}

export function errorBody(error: unknown): { error: { code: string; message: string } } {
  if (error instanceof TokenError) return { error: { code: error.code, message: error.message } };
  return { error: { code: "INTERNAL_ERROR", message: "Token operation failed" } };
}
