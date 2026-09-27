# Blockend Token Service

A source-owned TypeScript token primitive for a monolith or distributed system. It issues short-lived JWT access tokens, manages opaque one-time refresh tokens, verifies pinned issuer/audience/algorithm claims, rotates keys through `kid`, and supports shared Redis or PostgreSQL state.

## Security model

- Production mode is the default. It requires an HTTPS/URN issuer, audience, and asymmetric JWT algorithms.
- Access TTL is clamped to 60–3600 seconds (default 900). Refresh TTL is clamped to 3600–2,592,000 seconds (default seven days).
- Refresh values contain 256 random bits. Only SHA-256 hashes are stored.
- Refresh rotation is atomic. Reuse revokes the complete token family.
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

Use a shared store and a signing provider. `PostgresTokenStore` accepts a small database interface; wrap your existing `pg`, Prisma, or Drizzle transaction client. `RedisTokenStore` accepts clients exposing `get`, `set`, and `eval`. Apply [`sql/postgres.sql`](./sql/postgres.sql) before using PostgreSQL.

```ts
const tokens = createTokenService({
  issuer: "https://auth.company.com",
  audience: ["https://api.company.com", "https://admin.company.com"],
  algorithms: ["RS256"],
  accessTokenTtlSeconds: 600,
  refreshTokenTtlSeconds: 604800,
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

### Key providers

- `LocalKeyProvider`: PEM key ring. `signingKid` is current; old public keys remain available for verification until issued tokens expire.
- `KmsRsaKeyProvider`: vendor-neutral RS256 signer. Adapt AWS KMS `Sign`, Google Cloud KMS, Azure Key Vault, or an HSM to its one-method `KmsRsaSigner` interface.
- `RemoteJwksKeyProvider`: HTTPS, cached, verification-only provider for resource services. Calling `issue` or `refresh` with it fails closed.

For rotation, publish both old and new public keys, switch the issuer's active signing `kid`, wait at least the maximum access-token lifetime plus clock tolerance, and then remove the old key.

### Store requirements

`rotateRefreshToken` is the most important contract: it must lock/compare-and-set the old record, mark it used, and write its replacement atomically. A store implemented as `find()` followed by `revoke()` is vulnerable to concurrent refresh races.

The PostgreSQL implementation uses `SELECT ... FOR UPDATE`. The Redis implementation uses Lua for atomic consumption. Its related keys must share a writable Redis deployment; validate cluster hash-slot behavior for your Redis provider before production. PostgreSQL is the safer supplied choice for multi-region correctness. Multi-region deployments also need an explicit consistency model: eventual replicas are unsuitable for refresh rotation and immediate revocation.

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

- Cleanup used, revoked, and expired refresh rows after your audit-retention window; clean expired JTI rows continuously.
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
