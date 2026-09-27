import type { RefreshTokenRecord, RotateResult, TokenStore } from "../core/types.js";

export interface QueryResult<Row = Record<string, unknown>> {
  rows: Row[];
  rowCount: number | null;
}
export interface PgTransaction {
  query<Row = Record<string, unknown>>(sql: string, values?: unknown[]): Promise<QueryResult<Row>>;
}
export interface PgLike extends PgTransaction {
  transaction<T>(work: (tx: PgTransaction) => Promise<T>): Promise<T>;
}
type RefreshRow = {
  token_hash: string;
  family_id: string;
  subject: string;
  expires_at: Date;
  status: RefreshTokenRecord["status"];
  created_at: Date;
  used_at: Date | null;
  metadata: Record<string, unknown> | null;
};

/** PostgreSQL store using row locks for one-time refresh-token consumption. */
export class PostgresTokenStore implements TokenStore {
  constructor(
    private readonly db: PgLike,
    private readonly table = "blockend_refresh_tokens",
    private readonly denyTable = "blockend_revoked_jtis"
  ) {
    if (!/^[a-z_][a-z0-9_]*$/i.test(table) || !/^[a-z_][a-z0-9_]*$/i.test(denyTable))
      throw new Error("Unsafe SQL identifier");
  }
  async saveRefreshToken(r: RefreshTokenRecord): Promise<void> {
    await this.db.query(
      `INSERT INTO ${this.table} (token_hash,family_id,subject,expires_at,status,created_at,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [r.tokenHash, r.familyId, r.sub, r.expiresAt, r.status, r.createdAt, r.metadata ?? null]
    );
  }
  async getRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | undefined> {
    const result = await this.db.query<RefreshRow>(
      `SELECT * FROM ${this.table} WHERE token_hash=$1`,
      [tokenHash]
    );
    const row = result.rows[0];
    return row ? this.fromRow(row) : undefined;
  }
  async rotateRefreshToken(input: {
    currentHash: string;
    replacement: RefreshTokenRecord;
    now: Date;
  }): Promise<RotateResult> {
    return this.db.transaction(async (tx) => {
      const found = await tx.query<RefreshRow>(
        `SELECT * FROM ${this.table} WHERE token_hash=$1 FOR UPDATE`,
        [input.currentHash]
      );
      const row = found.rows[0];
      if (!row) return { status: "missing" };
      const current = this.fromRow(row);
      if (current.status === "used") {
        await tx.query(`UPDATE ${this.table} SET status='revoked' WHERE family_id=$1`, [
          current.familyId
        ]);
        return { status: "reused", record: current };
      }
      if (current.status === "revoked") return { status: "revoked", record: current };
      if (current.expiresAt.getTime() <= input.now.getTime())
        return { status: "expired", record: current };
      await tx.query(`UPDATE ${this.table} SET status='used',used_at=$2 WHERE token_hash=$1`, [
        input.currentHash,
        input.now
      ]);
      const next = { ...input.replacement, sub: current.sub, familyId: current.familyId };
      await tx.query(
        `INSERT INTO ${this.table} (token_hash,family_id,subject,expires_at,status,created_at,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          next.tokenHash,
          next.familyId,
          next.sub,
          next.expiresAt,
          next.status,
          next.createdAt,
          next.metadata ?? null
        ]
      );
      return { status: "rotated", record: next };
    });
  }
  async revokeByHash(hash: string): Promise<void> {
    await this.db.query(`UPDATE ${this.table} SET status='revoked' WHERE token_hash=$1`, [hash]);
  }
  async revokeByFamily(id: string): Promise<void> {
    await this.db.query(
      `UPDATE ${this.table} SET status='revoked' WHERE family_id=$1 AND status='active'`,
      [id]
    );
  }
  async revokeBySub(sub: string): Promise<void> {
    await this.db.query(
      `UPDATE ${this.table} SET status='revoked' WHERE subject=$1 AND status='active'`,
      [sub]
    );
  }
  async revokeByJti(jti: string, expiresAt?: Date): Promise<void> {
    await this.db.query(
      `INSERT INTO ${this.denyTable} (jti,expires_at) VALUES ($1,$2) ON CONFLICT (jti) DO UPDATE SET expires_at=EXCLUDED.expires_at`,
      [jti, expiresAt ?? new Date(Date.now() + 3_600_000)]
    );
  }
  async isJtiRevoked(jti: string): Promise<boolean> {
    const r = await this.db.query(
      `SELECT 1 FROM ${this.denyTable} WHERE jti=$1 AND expires_at>NOW()`,
      [jti]
    );
    return (r.rowCount ?? 0) > 0;
  }
  private fromRow(r: RefreshRow): RefreshTokenRecord {
    return {
      tokenHash: r.token_hash,
      familyId: r.family_id,
      sub: r.subject,
      expiresAt: r.expires_at,
      status: r.status,
      createdAt: r.created_at,
      ...(r.used_at ? { usedAt: r.used_at } : {}),
      ...(r.metadata ? { metadata: r.metadata } : {})
    };
  }
}
