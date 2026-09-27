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
  family_expires_at: Date;
  rotation_count: number;
  rotation_limit: number;
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
    await this.db.transaction(async (tx) => {
      await this.setReadCommitted(tx);
      await this.lockSubject(tx, r.sub);
      const clock = await tx.query<{ now: Date }>("SELECT clock_timestamp() AS now");
      const now = clock.rows[0]?.now;
      if (!(now instanceof Date)) throw new Error("PostgreSQL did not return its current time");
      const familyLifetime = r.familyExpiresAt.getTime() - r.createdAt.getTime();
      const refreshLifetime = r.expiresAt.getTime() - r.createdAt.getTime();
      if (familyLifetime <= 0 || refreshLifetime <= 0)
        throw new Error("Refresh family lifetime must be positive");
      const record = {
        ...r,
        createdAt: now,
        familyExpiresAt: new Date(now.getTime() + familyLifetime),
        expiresAt: new Date(
          Math.min(now.getTime() + refreshLifetime, now.getTime() + familyLifetime)
        )
      };
      await tx.query(
        `INSERT INTO ${this.table} (token_hash,family_id,subject,expires_at,family_expires_at,rotation_count,rotation_limit,status,created_at,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          record.tokenHash,
          record.familyId,
          record.sub,
          record.expiresAt,
          record.familyExpiresAt,
          record.rotationCount,
          record.rotationLimit,
          record.status,
          record.createdAt,
          record.metadata ?? null
        ]
      );
    });
  }
  async getRefreshToken(
    tokenHash: string,
    _familyId?: string
  ): Promise<RefreshTokenRecord | undefined> {
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
    maxRotations: number;
  }): Promise<RotateResult> {
    return this.db.transaction(async (tx) => {
      await this.setReadCommitted(tx);
      const identity = await tx.query<{ subject: string }>(
        `SELECT subject FROM ${this.table} WHERE token_hash=$1`,
        [input.currentHash]
      );
      const subject = identity.rows[0]?.subject;
      if (!subject) return { status: "missing" };
      await this.lockSubject(tx, subject);
      const found = await tx.query<RefreshRow>(
        `SELECT * FROM ${this.table} WHERE token_hash=$1 FOR UPDATE`,
        [input.currentHash]
      );
      const row = found.rows[0];
      if (!row) return { status: "missing" };
      const current = this.fromRow(row);
      const clock = await tx.query<{ now: Date }>("SELECT clock_timestamp() AS now");
      const databaseNow = clock.rows[0]?.now;
      if (!(databaseNow instanceof Date))
        throw new Error("PostgreSQL did not return its current time");
      if (current.status === "used") {
        await tx.query(`UPDATE ${this.table} SET status='revoked' WHERE family_id=$1`, [
          current.familyId
        ]);
        return { status: "reused", record: current };
      }
      if (current.status === "revoked") return { status: "revoked", record: current };
      if (current.expiresAt.getTime() <= databaseNow.getTime())
        return { status: "expired", record: current };
      if (current.familyExpiresAt.getTime() <= databaseNow.getTime())
        return { status: "expired", record: current };
      if (current.rotationCount >= Math.min(current.rotationLimit, input.maxRotations))
        return { status: "limit", record: current };
      const refreshLifetime =
        input.replacement.expiresAt.getTime() - input.replacement.createdAt.getTime();
      if (refreshLifetime <= 0) return { status: "expired", record: current };
      await tx.query(`UPDATE ${this.table} SET status='used',used_at=$2 WHERE token_hash=$1`, [
        input.currentHash,
        databaseNow
      ]);
      const next = {
        ...input.replacement,
        sub: current.sub,
        familyId: current.familyId,
        familyExpiresAt: current.familyExpiresAt,
        rotationCount: current.rotationCount + 1,
        rotationLimit: Math.min(current.rotationLimit, input.maxRotations),
        createdAt: databaseNow,
        expiresAt: new Date(
          Math.min(databaseNow.getTime() + refreshLifetime, current.familyExpiresAt.getTime())
        )
      };
      await tx.query(
        `INSERT INTO ${this.table} (token_hash,family_id,subject,expires_at,family_expires_at,rotation_count,rotation_limit,status,created_at,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          next.tokenHash,
          next.familyId,
          next.sub,
          next.expiresAt,
          next.familyExpiresAt,
          next.rotationCount,
          next.rotationLimit,
          next.status,
          next.createdAt,
          next.metadata ?? null
        ]
      );
      return { status: "rotated", record: next };
    });
  }
  async revokeByHash(hash: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      await this.setReadCommitted(tx);
      const found = await tx.query<{ subject: string; family_id: string }>(
        `SELECT subject,family_id FROM ${this.table} WHERE token_hash=$1`,
        [hash]
      );
      const identity = found.rows[0];
      if (!identity) return;
      await this.lockSubject(tx, identity.subject);
      await tx.query(
        `UPDATE ${this.table} SET status='revoked' WHERE family_id=$1 AND status='active'`,
        [identity.family_id]
      );
    });
  }
  async revokeByFamily(id: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      await this.setReadCommitted(tx);
      const subjects = await tx.query<{ subject: string }>(
        `SELECT DISTINCT subject FROM ${this.table} WHERE family_id=$1 ORDER BY subject`,
        [id]
      );
      for (const { subject } of subjects.rows) await this.lockSubject(tx, subject);
      await tx.query(
        `UPDATE ${this.table} SET status='revoked' WHERE family_id=$1 AND status='active'`,
        [id]
      );
    });
  }
  async revokeBySub(sub: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      await this.setReadCommitted(tx);
      await this.lockSubject(tx, sub);
      await tx.query(
        `UPDATE ${this.table} SET status='revoked' WHERE subject=$1 AND status='active'`,
        [sub]
      );
    });
  }
  async revokeByJti(jti: string, expiresAt?: Date): Promise<void> {
    await this.db.query(
      `INSERT INTO ${this.denyTable} (jti,expires_at) VALUES ($1,$2) ON CONFLICT (jti) DO UPDATE SET expires_at=EXCLUDED.expires_at`,
      [jti, expiresAt ?? new Date(Date.now() + 3_600_000)]
    );
    await this.db.query(
      `WITH expired AS (SELECT ctid FROM ${this.denyTable} WHERE expires_at <= NOW() LIMIT 1000) DELETE FROM ${this.denyTable} AS revoked USING expired WHERE revoked.ctid=expired.ctid`
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
      familyExpiresAt: r.family_expires_at,
      rotationCount: r.rotation_count,
      rotationLimit: r.rotation_limit,
      status: r.status,
      createdAt: r.created_at,
      ...(r.used_at ? { usedAt: r.used_at } : {}),
      ...(r.metadata ? { metadata: r.metadata } : {})
    };
  }

  private async lockSubject(tx: PgTransaction, subject: string): Promise<void> {
    await tx.query(`SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`, [
      "blockend_refresh_subject",
      subject
    ]);
  }

  private async setReadCommitted(tx: PgTransaction): Promise<void> {
    await tx.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
  }
}
