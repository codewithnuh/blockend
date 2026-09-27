# Blockend Token Service

A source-owned TypeScript token primitive for a monolith or distributed system. It issues short-lived JWT access tokens, manages opaque one-time refresh tokens, verifies pinned issuer/audience/algorithm claims, rotates keys through `kid`, and supports shared Redis or PostgreSQL state.

## Security model

- Production mode is the default. It requires an HTTPS/URN issuer, audience, and asymmetric JWT algorithms.
- Access TTL is clamped to 60–3600 seconds (default 900). Refresh TTL is clamped to 3600–2,592,000 seconds (default seven days).
- Refresh values contain a versioned family-routing hint and 256 random secret bits. Stores persist only SHA-256 hashes.
- Refresh rotation is atomic. Reuse revokes the complete token family.
- `revoke({ refreshToken })` revokes that token's entire family, including a descendant created by a concurrent rotation. Already issued access JWTs remain valid until expiry unless their JTIs are also revoked.
- Each refresh family expires no later than 90 days after issue and allows at most 10,000 successful rotations by default. Both limits are configurable and travel with the family, bounding retained replay state and preventing a differently configured replica from extending the family.
- Refresh-family revocation is also triggered by subject revocation, refresh-token logout, reuse, or the rotation ceiling.
- Callers cannot override `iss`, `sub`, `aud`, `iat`, `exp`, `jti`, or `type`.
- `kid` and `alg` must resolve to a pinned provider key. `none` is rejected.
- Error responses never include internal causes or stack traces.

This is token infrastructure, not a login system. Your application still owns user authentication, authorization, cookies, CSRF protection, rate limiting, session/device policy, and account recovery.

## Local development

```ts
import { createTokenService, LocalKeyProvider, MemoryTokenStore } from "@blockend/token-service";

const tokens = createTokenService({
  deploymentMode: "development",
  issuer: "http://localhost:3000",
  audience: "myapp",
  algorithms: ["RS256"],
  keyProvider: new LocalKeyProvider({
    signingKid: "dev-2026-01",
    keys: [
      {
        kid: "dev-2026-01",
        alg: "RS256",
        privateKeyPem: process.env.JWT_PRIVATE_KEY!,
        publicKeyPem: process.env.JWT_PUBLIC_KEY!
      }
    ]
  }),
  tokenStore: new MemoryTokenStore()
});
```

`MemoryTokenStore` is deliberately process-local. Restarting loses refresh and revocation state, and multiple instances will disagree. Never use it for horizontally scaled production.

For an access-token-only internal service, use `StatelessTokenStore` and always call `issue` with `tokens: { refresh: false }`. Refresh and server-side revocation deliberately return `UNSUPPORTED_OPERATION` in this mode.

## Distributed production

Use a shared store and a signing provider. `PostgresTokenStore` accepts a small database interface; wrap your existing `pg`, Prisma, or Drizzle transaction client. `RedisTokenStore` accepts a client adapter exposing `get`, `hget`, `set`, and `eval`. Apply [`sql/postgres.sql`](./sql/postgres.sql) before using PostgreSQL.

```ts
const tokens = createTokenService({
  issuer: "https://auth.company.com",
  audience: ["https://api.company.com", "https://admin.company.com"],
  algorithms: ["RS256"],
  accessTokenTtlSeconds: 600,
  refreshTokenTtlSeconds: 604800,
  maxRefreshFamilyLifetimeSeconds: 7776000,
  maxRefreshRotations: 10000,
  clockSkewSeconds: 45,
  keyProvider: kmsProvider,
  tokenStore: postgresStore,
  maxClaimsBytes: 2048,
  resolveRefreshContext: async (sub) => {
    const user = await users.findAuthorizationContext(sub);
    return { claims: { role: user.role, permissions: user.permissions } };
  },
  onEvent: (event) => logger.info(event)
});
```

`resolveRefreshContext` reloads current authorization data during refresh. Refresh tokens do not preserve roles or permissions, which avoids issuing new access tokens with stale privileges.

For Redis Cluster, use one stable routing secret in all issuer instances and pass a namespace without braces. Keep this secret in a secret manager; it is not the JWT signing key:

```ts
const redisStore = new RedisTokenStore(redisAdapter, {
  prefix: "company-auth:v2:",
  subjectRoutingKey: Buffer.from(process.env.TOKEN_REDIS_SUBJECT_KEY!, "base64url")
});
```

Changing `TOKEN_REDIS_SUBJECT_KEY` requires revoking all old families or waiting for their absolute lifetime to end before removing the previous deployment. Redis subject routing keys are also used by `revokeBySub()`.

### Key providers

- `LocalKeyProvider`: PEM key ring. `signingKid` is current; old public keys remain available for verification until issued tokens expire.
- `KmsRsaKeyProvider`: vendor-neutral RS256 signer. Adapt AWS KMS `Sign`, Google Cloud KMS, Azure Key Vault, or an HSM to its one-method `KmsRsaSigner` interface.
- `RemoteJwksKeyProvider`: HTTPS, cached, verification-only provider for resource services. Calling `issue` or `refresh` with it fails closed.

For rotation, publish both old and new public keys, switch the issuer's active signing `kid`, wait at least the maximum access-token lifetime plus clock tolerance, and then remove the old key.

### Store requirements

`rotateRefreshToken` is the most important contract: it must lock/compare-and-set the old record, mark it used, and write its replacement atomically. A store implemented as `find()` followed by `revoke()` is vulnerable to concurrent refresh races.

PostgreSQL transactions explicitly use `READ COMMITTED` and coordinate token rotation, refresh-token logout, subject logout, and issuance with the same subject advisory lock. Its `transaction()` wrapper must run all callback queries on the same connection and must not issue queries before the store callback starts. `sql/postgres.sql` upgrades older schemas; schedule its bounded cleanup queries after applying it.

The Redis implementation keeps each subject's generation counter and family hashes under an HMAC-derived Redis Cluster hash tag. It passes every Lua key explicitly, performs O(1) rotation and reuse detection, and never puts the subject value in Redis keys. Supply a stable secret of at least 32 bytes to every service instance. Do not change that key until all families created with it have expired or been revoked; changing it early prevents `revokeBySub()` from reaching older sessions. A subject's traffic maps to one cluster slot, while different subjects distribute across the cluster.

Refresh tokens now use a versioned format. Deploying this version invalidates refresh tokens issued by the previous format; users must authenticate again. Redis also uses a new `blockend:v2:` key namespace, leaving old keys untouched until their prior TTLs expire. Roll all issuer instances together and use the same prefix and routing key. On a primary, Lua scripts serialize changes for a slot. Redis Cluster replication is asynchronous, so failover can lose acknowledged changes; replicas are not read sources for refresh or revocation checks.

Run token state in a dedicated Redis deployment configured with `maxmemory-policy noeviction`; when memory fills, Redis must reject writes rather than evict refresh or revocation state. Monitor memory and failed writes and alert before the limit is reached. Standard Redis Cluster replication is asynchronous and can lose acknowledged writes during failover, so use PostgreSQL when your threat model requires strict revocation durability across failover. See the [Redis eviction policy](https://redis.io/docs/latest/develop/reference/eviction/) and [Cluster specification](https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/).

## HTTP adapters

Adapters expose `/refresh` by default. `/issue`, `/verify`, and `/revoke` are opt-in. `/issue` and `/revoke` also require an application authorization callback; do not expose them directly to the public internet.

```ts
app.use(
  "/auth/tokens",
  createExpressTokenRouter(tokens, {
    exposeIssue: true,
    exposeRevoke: true,
    authorize: (_action, req) => req.auth?.service === "identity-api"
  })
);
```

For browser apps, prefer refresh tokens in `Secure`, `HttpOnly`, `SameSite` cookies. If cookies authenticate a state-changing refresh or revoke request, add CSRF protection and restrict CORS. Never put refresh tokens in URLs or browser local storage.

## Operations

- Run these bounded cleanup statements periodically. Family expiry is absolute, so deleting its rows cannot erase a live descendant's reuse marker:

```sql
WITH expired AS (
  SELECT ctid FROM blockend_refresh_tokens
  WHERE family_expires_at <= NOW()
  LIMIT 1000
)
DELETE FROM blockend_refresh_tokens AS tokens
USING expired
WHERE tokens.ctid = expired.ctid;

WITH expired AS (
  SELECT ctid FROM blockend_revoked_jtis
  WHERE expires_at <= NOW()
  LIMIT 1000
)
DELETE FROM blockend_revoked_jtis AS revoked
USING expired
WHERE revoked.ctid = expired.ctid;
```

- Alert on `token.reuse_detected`, store failures, key failures, and abnormal refresh volume. Events intentionally contain identifiers, never raw tokens.
- Rate-limit refresh and privileged routes. Apply request body limits before adapters.
- Keep clocks synchronized. Clock tolerance handles small drift, not broken hosts.
- Scope audiences narrowly. A token accepted by every service defeats audience isolation.
- A JTI denylist makes access-token verification stateful. If immediate access revocation is unnecessary, use short access TTLs and omit JTI methods in a custom store.

## Commands

```bash
npm install
npm run typecheck
npm test
npm run test:coverage
```

## Files

- `src/core`: service, types, validation, errors, cryptographic helpers
- `src/providers`: local PEM, remote JWKS, and vendor-neutral KMS providers
- `src/stores`: memory, Redis, and PostgreSQL stores
- `src/adapters`: Express, Fastify, and Hono routes
- `tests`: security-critical unit tests
- `sql/postgres.sql`: production schema and indexes
