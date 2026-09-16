export type ErrorCategory =
  | "BAD_REQUEST"
  | "VALIDATION"
  | "AUTHENTICATION"
  | "AUTHORIZATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMIT"
  | "INTERNAL"
  | "SERVICE_UNAVAILABLE"
  | (string & {});

export type ErrorSeverity = "info" | "warning" | "error" | "critical";

export interface AppErrorOptions {
  code: string;
  message: string;
  statusCode?: number;
  category?: ErrorCategory;
  severity?: ErrorSeverity;
  isOperational?: boolean;
  cause?: unknown;
  /** Server-side diagnostic data. Never included in the default client response. */
  metadata?: Record<string, unknown>;
  /** Client-safe structured details for operational errors. */
  details?: unknown;
}

export interface ErrorContextInput {
  requestId?: string;
  userId?: string;
  path?: string;
  method?: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

export interface ErrorContext extends ErrorContextInput {
  timestamp: string;
}

export interface ClassifiedError {
  name: string;
  code: string;
  message: string;
  statusCode: number;
  category: ErrorCategory;
  severity: ErrorSeverity;
  isOperational: boolean;
  stack?: string;
  cause?: unknown;
  metadata?: Record<string, unknown>;
  details?: unknown;
}

export interface ErrorResponse {
  /** Matches the error envelope produced by the response-formatter block. */
  success: false;
  data: null;
  error: { message: string; details?: unknown };
  requestId?: string;
}

export interface ErrorEvent {
  error: {
    name: string;
    code: string;
    message: string;
    statusCode: number;
    category: ErrorCategory;
    severity: ErrorSeverity;
    isOperational: boolean;
    stack?: string;
    cause?: unknown;
    metadata?: Record<string, unknown>;
  };
  context: ErrorContext;
}

export interface ErrorLogger {
  /** Compatible with the structured logger block's `logger.error` method. */
  error(context: Record<string, unknown>, message?: string): void;
}

export interface ErrorReporter {
  report(event: ErrorEvent): void | Promise<void>;
}

export type ErrorClassifier = (error: unknown) => AppErrorOptions | null | undefined;
export type ErrorSerializer = (error: ClassifiedError, context: ErrorContext) => ErrorResponse;

export interface CreateErrorBoundaryOptions {
  logger?: ErrorLogger;
  reporter?: ErrorReporter;
  classifier?: ErrorClassifier;
  serializer?: ErrorSerializer;
  /** Additional case-insensitive key fragments to redact. */
  sensitiveKeys?: readonly string[];
}

export interface ErrorBoundaryResult {
  statusCode: number;
  body: ErrorResponse;
}

export interface ErrorBoundary {
  handle(error: unknown, context?: ErrorContextInput): Promise<ErrorBoundaryResult>;
}
