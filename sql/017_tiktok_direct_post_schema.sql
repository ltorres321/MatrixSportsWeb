-- Direct TikTok Content Posting API integration (bypasses SocialClaw,
-- whose hosted asset URLs are failing TikTok's own pull step with
-- photo_pull_failed -- see SportsContentCreation/tiktok_support_message.md).
--
-- tiktok_oauth_tokens: holds the single connected creator account's
-- OAuth tokens (Login Kit). One row, keyed by open_id. Both SportsWeb
-- (web/src/app/api/tiktok/connect + callback, the one-time OAuth
-- dance) and SportsContentCreation (src/lib/tiktokClient.ts, the
-- refresh-and-publish job) read/write this directly through their own
-- Postgres pool (lib/db.ts) -- same shared DATABASE_URL both repos
-- already use. No client-facing RLS policy, same belt-and-suspenders
-- default-deny as admin_users (sql/009): this table is never queried
-- through Supabase's RLS-gated REST API, only this app's own server
-- code.
--
-- Run once against the database DATABASE_URL points at:
--   psql "$DATABASE_URL" -f sql/017_tiktok_direct_post_schema.sql

CREATE TABLE IF NOT EXISTS tiktok_oauth_tokens (
    open_id             TEXT PRIMARY KEY,
    access_token        TEXT NOT NULL,
    access_expires_at   TIMESTAMPTZ NOT NULL,
    refresh_token       TEXT NOT NULL,
    refresh_expires_at  TIMESTAMPTZ NOT NULL,
    scope               TEXT NOT NULL,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE tiktok_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- tiktok_post_assets: short-lived public staging for whatever image
-- TikTok's servers need to PULL_FROM_URL -- photo posts only support
-- that source (no FILE_UPLOAD for photos, confirmed against TikTok's
-- current API docs), so the image has to be fetchable at a real,
-- verified-domain HTTPS URL at publish time. SportsContentCreation's
-- job images only ever exist on local disk / base64 in memory, so it
-- POSTs the bytes here (web/src/app/api/tiktok/assets, content-job
-- auth) to get a matrixsports.net URL back, then hands that URL to
-- TikTok's content/init call. Served back out by
-- web/src/app/api/tiktok/asset/[id]/route.ts -- deliberately
-- unauthenticated, since TikTok's own servers fetch it anonymously.
CREATE TABLE IF NOT EXISTS tiktok_post_assets (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_type  TEXT NOT NULL,
    image_bytes   BYTEA NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE tiktok_post_assets ENABLE ROW LEVEL SECURITY;
