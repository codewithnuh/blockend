CREATE TABLE IF NOT EXISTS blockend_refresh_tokens (
  token_hash text PRIMARY KEY,
  family_id uuid NOT NULL,
  subject text NOT NULL,
  expires_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'used', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz,
  metadata jsonb
);
CREATE INDEX IF NOT EXISTS blockend_refresh_family_idx ON blockend_refresh_tokens (family_id);
CREATE INDEX IF NOT EXISTS blockend_refresh_subject_idx ON blockend_refresh_tokens (subject);
CREATE INDEX IF NOT EXISTS blockend_refresh_expiry_idx ON blockend_refresh_tokens (expires_at);

CREATE TABLE IF NOT EXISTS blockend_revoked_jtis (
  jti text PRIMARY KEY,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS blockend_revoked_jti_expiry_idx ON blockend_revoked_jtis (expires_at);
