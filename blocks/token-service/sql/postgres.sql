CREATE TABLE IF NOT EXISTS blockend_refresh_tokens (
  token_hash text PRIMARY KEY,
  family_id uuid NOT NULL,
  subject text NOT NULL,
  expires_at timestamptz NOT NULL,
  family_expires_at timestamptz NOT NULL,
  rotation_count integer NOT NULL DEFAULT 0 CHECK (rotation_count >= 0),
  rotation_limit integer NOT NULL DEFAULT 10000 CHECK (rotation_limit > 0),
  status text NOT NULL CHECK (status IN ('active', 'used', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz,
  metadata jsonb
);
-- Upgrade pre-v2 installations. Old families receive the default 90-day absolute cap.
ALTER TABLE blockend_refresh_tokens ADD COLUMN IF NOT EXISTS family_expires_at timestamptz;
ALTER TABLE blockend_refresh_tokens ADD COLUMN IF NOT EXISTS rotation_count integer;
ALTER TABLE blockend_refresh_tokens ADD COLUMN IF NOT EXISTS rotation_limit integer;
WITH family_limits AS (
  SELECT family_id, MIN(created_at) + INTERVAL '90 days' AS family_expires_at,
    GREATEST(COUNT(*) - 1, 0)::integer AS rotation_count
  FROM blockend_refresh_tokens GROUP BY family_id
)
UPDATE blockend_refresh_tokens AS tokens
SET family_expires_at = COALESCE(tokens.family_expires_at, family_limits.family_expires_at),
    rotation_count = COALESCE(tokens.rotation_count, family_limits.rotation_count),
    rotation_limit = COALESCE(tokens.rotation_limit, 10000)
FROM family_limits
WHERE tokens.family_id = family_limits.family_id
  AND (tokens.family_expires_at IS NULL OR tokens.rotation_count IS NULL OR tokens.rotation_limit IS NULL);
ALTER TABLE blockend_refresh_tokens ALTER COLUMN family_expires_at SET NOT NULL;
ALTER TABLE blockend_refresh_tokens ALTER COLUMN rotation_count SET DEFAULT 0;
ALTER TABLE blockend_refresh_tokens ALTER COLUMN rotation_count SET NOT NULL;
ALTER TABLE blockend_refresh_tokens ALTER COLUMN rotation_limit SET DEFAULT 10000;
ALTER TABLE blockend_refresh_tokens ALTER COLUMN rotation_limit SET NOT NULL;
CREATE INDEX IF NOT EXISTS blockend_refresh_family_idx ON blockend_refresh_tokens (family_id);
CREATE INDEX IF NOT EXISTS blockend_refresh_subject_idx ON blockend_refresh_tokens (subject);
CREATE INDEX IF NOT EXISTS blockend_refresh_expiry_idx ON blockend_refresh_tokens (expires_at);
CREATE INDEX IF NOT EXISTS blockend_refresh_family_expiry_idx ON blockend_refresh_tokens (family_expires_at);

CREATE TABLE IF NOT EXISTS blockend_revoked_jtis (
  jti text PRIMARY KEY,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS blockend_revoked_jti_expiry_idx ON blockend_revoked_jtis (expires_at);
