import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { exportPKCS8, exportSPKI, generateKeyPair } from "jose";
import { createTokenService, LocalKeyProvider, PostgresTokenStore } from "../../src/index.js";
import { hashToken } from "../../src/core/crypto.js";
import type { PgLike, PgTransaction, QueryResult } from "../../src/stores/postgres-token-store.js";

const connectionString = process.env.TOKEN_SERVICE_POSTGRES_URL;
const postgresIntegration = describe.skipIf(!connectionString);

let adminPool: Pool | undefined;
let storePool: Pool | undefined;
let schema: string | undefined;
let tokens: ReturnType<typeof createTokenService>;
let postgresStore: PostgresTokenStore;
let keyProvider: LocalKeyProvider;

async function queryRows<Row>(
  client: Pool | PoolClient,
  sql: string,
  values?: unknown[]
): Promise<QueryResult<Row>> {
  const result = await client.query(sql, values);
  return { rows: result.rows as Row[], rowCount: result.rowCount };
}

postgresIntegration("PostgresTokenStore integration", () => {
  beforeAll(async () => {
    adminPool = new Pool({ connectionString });
    schema = `token_service_it_${randomUUID().replaceAll("-", "")}`;
    await adminPool.query(`CREATE SCHEMA "${schema}"`);

    storePool = new Pool({
      connectionString,
      options: `-c search_path=${schema}`
    });
    const migration = await readFile(new URL("../../sql/postgres.sql", import.meta.url), "utf8");
    await storePool.query(migration);

    const pair = await generateKeyPair("RS256", { extractable: true });
    keyProvider = new LocalKeyProvider({
      signingKid: "ci-2026",
      keys: [
        {
          kid: "ci-2026",
          alg: "RS256",
          privateKeyPem: await exportPKCS8(pair.privateKey),
          publicKeyPem: await exportSPKI(pair.publicKey)
        }
      ]
    });
    const pool = storePool;
    const db: PgLike = {
      query: async <Row = Record<string, unknown>>(sql: string, values?: unknown[]) =>
        queryRows<Row>(pool, sql, values),
      transaction: async <Result>(work: (tx: PgTransaction) => Promise<Result>) => {
        const client = await pool.connect();
        await client.query("BEGIN");
        const tx: PgTransaction = {
          query: async <Row = Record<string, unknown>>(sql: string, values?: unknown[]) =>
            queryRows<Row>(client, sql, values)
        };
        try {
          const result = await work(tx);
          await client.query("COMMIT");
          return result;
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        } finally {
          client.release();
        }
      }
    };

    postgresStore = new PostgresTokenStore(db);
    tokens = createTokenService({
      issuer: "https://auth.example.com",
      audience: "api.example.com",
      algorithms: ["RS256"],
      keyProvider,
      tokenStore: postgresStore
    });
  });

  afterAll(async () => {
    await storePool?.end();
    if (adminPool && schema) await adminPool.query(`DROP SCHEMA "${schema}" CASCADE`);
    await adminPool?.end();
  });

  it("applies the schema and revokes a family after concurrent refresh reuse", async () => {
    const issued = await tokens.issue({ sub: "postgres-ci-user" });
    const results = await Promise.allSettled([
      tokens.refresh(issued.refreshToken!),
      tokens.refresh(issued.refreshToken!)
    ]);
    const fulfilled = results.filter(
      (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof tokens.refresh>>> =>
        result.status === "fulfilled"
    );
    const rejected = results.filter((result) => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    await expect(tokens.refresh(fulfilled[0]!.value.refreshToken!)).rejects.toMatchObject({
      code: "TOKEN_REVOKED"
    });
  });

  it("persists subject revocation and the JTI denylist", async () => {
    const issued = await tokens.issue({ sub: "postgres-revocation-user" });
    const verified = await tokens.verify(issued.accessToken!);

    await tokens.revoke({ jti: verified.claims.jti });
    await expect(tokens.verify(issued.accessToken!)).rejects.toMatchObject({
      code: "TOKEN_REVOKED"
    });

    await tokens.revoke({ sub: "postgres-revocation-user" });
    await expect(tokens.refresh(issued.refreshToken!)).rejects.toMatchObject({
      code: "TOKEN_REVOKED"
    });
  });

  it("revokes a family when an older refresh token is explicitly revoked", async () => {
    const issued = await tokens.issue({ sub: "postgres-refresh-revoke-user" });
    const rotated = await tokens.refresh(issued.refreshToken!);

    await tokens.revoke({ refreshToken: issued.refreshToken! });

    await expect(tokens.refresh(rotated.refreshToken!)).rejects.toMatchObject({
      code: "TOKEN_REVOKED"
    });
  });

  it("enforces a persisted refresh-family rotation limit", async () => {
    const limited = createTokenService({
      issuer: "https://auth.example.com",
      audience: "api.example.com",
      algorithms: ["RS256"],
      keyProvider,
      tokenStore: postgresStore,
      maxRefreshRotations: 1
    });
    const issued = await limited.issue({ sub: "postgres-rotation-limit" });
    const rotated = await limited.refresh(issued.refreshToken!);

    await expect(limited.refresh(rotated.refreshToken!)).rejects.toMatchObject({
      code: "REFRESH_LIMIT"
    });
  });

  it.each(["subject", "family"] as const)(
    "orders a concurrent refresh against %s revocation so no descendant remains active",
    async (target) => {
      const issued = await tokens.issue({ sub: `postgres-race-${target}` });
      const record = await postgresStore.getRefreshToken(hashToken(issued.refreshToken!));
      if (!record) throw new Error("Expected issued refresh token to be stored");

      const [rotation] = await Promise.allSettled([
        tokens.refresh(issued.refreshToken!),
        target === "subject"
          ? tokens.revoke({ sub: record.sub })
          : tokens.revoke({ familyId: record.familyId })
      ]);
      const descendant =
        rotation.status === "fulfilled" ? rotation.value.refreshToken! : issued.refreshToken!;
      await expect(tokens.refresh(descendant)).rejects.toMatchObject({ code: "TOKEN_REVOKED" });
    }
  );
});
