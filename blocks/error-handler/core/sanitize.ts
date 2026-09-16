/** Built-in case-insensitive key fragments redacted by the sanitizer. */
export const DEFAULT_SENSITIVE_KEYS = [
  "password",
  "passphrase",
  "token",
  "authorization",
  "secret",
  "apikey",
  "cookie"
] as const;

const REDACTED = "[REDACTED]";
const CIRCULAR = "[Circular]";
const TRUNCATED = "[Truncated]";

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Deep-clone and redact sensitive keys, circular references, and unserializable values. */
export function sanitizeErrorData<T>(value: T, additionalKeys: readonly string[] = []): T {
  const sensitiveKeys = [...DEFAULT_SENSITIVE_KEYS, ...additionalKeys].map(normalizeKey);
  const seen = new WeakSet<object>();

  const visit = (current: unknown, depth: number): unknown => {
    if (current === null || current === undefined) return current;
    if (typeof current === "bigint") return current.toString();
    if (typeof current === "symbol") return current.toString();
    if (typeof current === "function") return "[Function]";
    if (typeof current !== "object") return current;
    if (depth >= 8) return TRUNCATED;
    if (seen.has(current)) return CIRCULAR;

    seen.add(current);

    if (current instanceof Date) {
      let result: unknown;
      try {
        result = current.toISOString();
      } catch {
        result = "[Unserializable]";
      }
      seen.delete(current);
      return result;
    }
    if (current instanceof Error) {
      const result = visit(
        {
          name: current.name,
          message: current.message,
          ...(current.stack === undefined ? {} : { stack: current.stack }),
          ...(current.cause === undefined ? {} : { cause: current.cause })
        },
        depth + 1
      );
      seen.delete(current);
      return result;
    }
    if (Array.isArray(current)) {
      const result = current.map((entry) => visit(entry, depth + 1));
      seen.delete(current);
      return result;
    }

    const sanitized: Record<string, unknown> = {};
    let entries: [string, unknown][];
    try {
      entries = Object.entries(current);
    } catch {
      seen.delete(current);
      return "[Unserializable]";
    }

    for (const [key, entry] of entries) {
      const normalized = normalizeKey(key);
      sanitized[key] = sensitiveKeys.some((sensitive) => normalized.includes(sensitive))
        ? REDACTED
        : visit(entry, depth + 1);
    }
    seen.delete(current);
    return sanitized;
  };

  return visit(value, 0) as T;
}
