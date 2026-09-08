-- Profiles -- one row per real Supabase Auth user (auth.users), holding
-- the same fields the old placeholder signup.html/subscribers table
-- captured, but now attached to a real account instead of just a lead.
--
-- subscribers (sql/001, sql/002) stays as-is: it's the pre-auth signup
-- capture. profiles is what the new Next.js app's real signup writes
-- to, and what the real Profile page (password reset, email change,
-- phone, favorite team, notifications) reads/writes going forward.
--
-- Row Level Security restricts every row to the user who owns it --
-- auth.uid() is the signed-in user's id, set by Supabase's JWT
-- verification on every request, so this holds even if the anon/public
-- API key leaks (it's meant to be public; RLS is what makes that safe).
--
-- Run once against the database DATABASE_URL points at:
--   psql "$DATABASE_URL" -f sql/003_profiles_schema.sql

CREATE TABLE IF NOT EXISTS profiles (
    id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name          TEXT NOT NULL,
    middle_name         TEXT,
    last_name           TEXT NOT NULL,
    cell                TEXT,
    address             TEXT,
    city                TEXT,
    state               TEXT,
    zip                 TEXT,
    favorite_team       TEXT,
    notify_win_prob     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Keep updated_at honest on every UPDATE.
CREATE OR REPLACE FUNCTION set_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON profiles;
CREATE TRIGGER profiles_set_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION set_profiles_updated_at();
