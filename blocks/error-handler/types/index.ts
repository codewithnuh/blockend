/** Classification bucket for an error, used to derive status codes and severity. */
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

/** Severity level assigned to a classified error. */
export type ErrorSeverity = "info" | "warning" | "error" | "critical";

/** Options for constructing an {@link AppError}. */
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

/** Partial context supplied by an adapter before enrichment. */
export interface ErrorContextInput {
  requestId?: string;
  userId?: string;
  path?: string;
  method?: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

/** Fully resolved error context with a required timestamp. */
export interface ErrorContext extends ErrorContextInput {
  timestamp: string;
}

/** Internal representation of an error after classification. */
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

/** Safe envelope returned to the client. */
export interface ErrorResponse {
  /** Matches the error envelope produced by the response-formatter block. */
  success: false;
  data: null;
  error: { message: string; details?: unknown };
  requestId?: string;
}

/** Structured event passed to loggers and reporters. */
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

/** Sink for structured error logging. */
export interface ErrorLogger {
  /** Compatible with the structured logger block's `logger.error` method. */
  error(context: Record<string, unknown>, message?: string): void;
}

/** Sink for forwarding error events to external services. */
export interface ErrorReporter {
  report(event: ErrorEvent): void | Promise<void>;
}

/** User-provided function that maps a raw error to {@link AppErrorOptions}. */
export type ErrorClassifier = (error: unknown) => AppErrorOptions | null | undefined;
/** Serializer that converts a classified error into a client-safe envelope. */
export type ErrorSerializer = (error: ClassifiedError, context: ErrorContext) => ErrorResponse;

/** Configuration for {@link createErrorBoundary}. */
export interface CreateErrorBoundaryOptions {
  logger?: ErrorLogger;
  reporter?: ErrorReporter;
  classifier?: ErrorClassifier;
  serializer?: ErrorSerializer;
  /** Additional case-insensitive key fragments to redact. */
  sensitiveKeys?: readonly string[];
}

/** Result returned by {@link ErrorBoundary.handle}. */
export interface ErrorBoundaryResult {
  statusCode: number;
  body: ErrorResponse;
}

/** Framework-agnostic error boundary that classifies, logs, and serializes errors. */
export interface ErrorBoundary {
  handle(error: unknown, context?: ErrorContextInput): Promise<ErrorBoundaryResult>;
}
