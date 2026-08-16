export type CachedResponse = {
  status: "SUCCESS" | "FAILED";
  request_hash: string;
  response: unknown;
};

export type IdempotencyStatus = "PROCESSING" | "SUCCESS" | "FAILED";

export type IdempotencyRecord = {
  key: string;
  userId: string;
  operation: string;
  requestHash: string;
  status: IdempotencyStatus;
  response?: unknown;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Input shape for creating a new idempotency record.
 *
 * Deliberately structural (no ORM imports): the core stays framework- and
 * package-agnostic. Concrete adapters (e.g. a Prisma store) map these fields to
 * their own schema.
 */
export type CreateIdempotencyRecord = {
  key: string;
  request_hash: string;
  user_id: string;
  status: IdempotencyStatus;
  response: unknown;
  operation: string;
  expires_at: Date;
};

export type CreateRecordResult = { status: "CREATED" } | { status: "DUPLICATE" };

export type CreateProcessingResult =
  | { kind: "CREATED"; record: IdempotencyRecord }
  | { kind: "EXISTING_SUCCESS"; response: unknown }
  | { kind: "EXISTING_PROCESSING" } // throw
  | { kind: "EXISTING_FAILED" }; // throw
