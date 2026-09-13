-- admin_users -- marks a real auth.users row as an admin. Deliberately
-- NOT a column on profiles: profiles already has an RLS policy letting
-- a user update their OWN row ("Users can update their own profile"),
-- so an is_admin column there would need to be carefully excluded from
-- that policy to avoid self-elevation. A separate table with NO
-- client-facing policies at all is simpler to get right -- every row
-- here is only ever read/written through the app's own server-side
-- Postgres pool (src/lib/db.ts), never through Supabase's RLS-gated
-- REST API, so RLS is enabled with zero policies as a belt-and-suspenders
-- default-deny even if it were ever queried through that path by mistake.
--
-- Rows are inserted manually (by whoever operates this database) after
-- the person has already signed up for a real account through the
-- site's own signup flow -- this table only grants admin status to an
-- EXISTING auth.users row, it never creates one.
--
-- Run once against the database DATABASE_URL points at:
--   psql "$DATABASE_URL" -f sql/009_admin_users_schema.sql

CREATE TABLE IF NOT EXISTS admin_users (
    user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
