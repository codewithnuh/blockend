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
    if (current instanceof Date) return current.toISOString();
    if (current instanceof Error) {
      return visit(
        {
          name: current.name,
          message: current.message,
          ...(current.stack === undefined ? {} : { stack: current.stack }),
          ...(current.cause === undefined ? {} : { cause: current.cause })
        },
        depth + 1
      );
    }
    if (Array.isArray(current)) return current.map((entry) => visit(entry, depth + 1));

    const sanitized: Record<string, unknown> = {};
    let entries: [string, unknown][];
    try {
      entries = Object.entries(current);
    } catch {
      return "[Unserializable]";
    }

    for (const [key, entry] of entries) {
      const normalized = normalizeKey(key);
      sanitized[key] = sensitiveKeys.some((sensitive) => normalized.includes(sensitive))
        ? REDACTED
        : visit(entry, depth + 1);
    }
    return sanitized;
  };

  return visit(value, 0) as T;
}
