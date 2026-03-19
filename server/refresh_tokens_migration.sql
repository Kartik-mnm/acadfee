-- Migration: persistent refresh token store
-- Run this once on your PostgreSQL database, OR let the server auto-create it on startup.
-- The server/routes/auth.js already calls this automatically via initRefreshTokensTable().

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          SERIAL PRIMARY KEY,
  token       TEXT NOT NULL UNIQUE,
  payload     JSONB NOT NULL,               -- stores the JWT payload (id, role, branch_id, name)
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast token lookup on every refresh request
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);

-- Index for fast cleanup of expired tokens
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);
