import { describe, expect, it } from "vitest";
import {
  PostgresTokenStore,
  type PgLike,
  type PgTransaction,
  type QueryResult
} from "../../src/stores/postgres-token-store.js";

const row = {
  token_hash: "current-hash",
  family_id: "a360a7a2-d070-49f6-bdb7-2b7e3a91d490",
  subject: "user-1",
  expires_at: new Date("2027-01-01T00:00:00Z"),
  status: "active" as const,
  created_at: new Date("2026-01-01T00:00:00Z"),
  used_at: null,
  metadata: null
};

describe("PostgresTokenStore", () => {
  it("locks and replaces a refresh token inside the caller transaction", async () => {
    const queries: string[] = [];
    const query: PgLike["query"] = async <T = Record<string, unknown>>(
      sql: string,
      _values?: unknown[]
    ): Promise<QueryResult<T>> => {
      queries.push(sql);
      return sql.startsWith("SELECT")
        ? ({ rows: [row] as T[], rowCount: 1 } as QueryResult<T>)
        : ({ rows: [], rowCount: 1 } as QueryResult<T>);
    };
    const db: PgLike = {
      query,
      transaction: async <T>(work: (tx: PgTransaction) => Promise<T>) => work({ query })
    };
    const store = new PostgresTokenStore(db);
    const result = await store.rotateRefreshToken({
      currentHash: "current-hash",
      replacement: {
        tokenHash: "next-hash",
        familyId: "placeholder",
        sub: "placeholder",
        status: "active",
        createdAt: new Date("2026-06-01T00:00:00Z"),
        expiresAt: new Date("2026-06-08T00:00:00Z")
      },
      now: new Date("2026-06-01T00:00:00Z")
    });

    expect(result.status).toBe("rotated");
    expect(queries).toHaveLength(5);
    expect(queries[0]).toContain("SELECT subject");
    expect(queries[1]).toContain("pg_advisory_xact_lock");
    expect(queries[2]).toContain("FOR UPDATE");
    expect(queries[3]).toContain("SET status='used'");
    expect(queries[4]).toContain("INSERT INTO blockend_refresh_tokens");
    if (result.status === "rotated") {
      expect(result.record.sub).toBe("user-1");
      expect(result.record.familyId).toBe(row.family_id);
    }
  });

  it("uses the same subject advisory lock before subject and family revocation", async () => {
    const queries: string[] = [];
    const query: PgLike["query"] = async <T = Record<string, unknown>>(
      sql: string
    ): Promise<QueryResult<T>> => {
      queries.push(sql);
      if (sql.includes("SELECT DISTINCT subject"))
        return { rows: [{ subject: "user-1" }] as T[], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    };
    const db: PgLike = {
      query,
      transaction: async <T>(work: (tx: PgTransaction) => Promise<T>) => work({ query })
    };
    const store = new PostgresTokenStore(db);

    await store.revokeBySub("user-1");
    expect(queries[0]).toContain("pg_advisory_xact_lock");
    expect(queries[1]).toContain("WHERE subject=$1");
    queries.length = 0;

    await store.revokeByFamily(row.family_id);
    expect(queries[0]).toContain("SELECT DISTINCT subject");
    expect(queries[1]).toContain("pg_advisory_xact_lock");
    expect(queries[2]).toContain("WHERE family_id=$1");
  });

  it("rejects unsafe table identifiers before composing SQL", () => {
    const db: PgLike = {
      query: async <T = Record<string, unknown>>(): Promise<QueryResult<T>> => ({
        rows: [],
        rowCount: 0
      }),
      transaction: async <T>(work: (tx: PgTransaction) => Promise<T>) =>
        work({
          query: async <Row = Record<string, unknown>>(): Promise<QueryResult<Row>> => ({
            rows: [],
            rowCount: 0
          })
        })
    };

    expect(() => new PostgresTokenStore(db, "tokens; DROP TABLE users")).toThrow(
      "Unsafe SQL identifier"
    );
  });
});
