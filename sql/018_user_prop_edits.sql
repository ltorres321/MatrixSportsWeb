-- "Line Edit" (2026-11-15): lets a signed-in user try a different
-- odds/line/over-under on one leg of an already-built parlay and see
-- how that tile's own probability/payout would change. Deliberately a
-- SEPARATE table from any site-derived props/picks table -- the site's
-- own parlay construction (buildNbaLeagueParlays/bestParlay/etc.) and
-- every graded record always read site data only, never this table, so
-- a user's hypothetical edits can never shift what parlay "wins" or
-- what the site's own hit/missed stats say (user, 2026-11-15: "the site
-- will still be graded on site derived numbers not user edits").
--
-- One row per (user, pick) override. pick_key is a stable identity
-- built from the pick's ORIGINAL (unedited) data -- see propEdits.ts's
-- buildPickKey -- so editing a pick twice updates the same row instead
-- of piling up history, and the key itself never changes when the
-- stored line/side/odds do.
--
-- Row Level Security follows the same per-owner pattern as profiles
-- (sql/003) -- auth.uid() must match user_id on every operation.
--
-- SANDBOX ONLY -- not yet run against the live database. Apply with:
--   psql "$DATABASE_URL" -f sql/018_user_prop_edits.sql

CREATE TABLE IF NOT EXISTS user_prop_edits (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    pick_key        TEXT NOT NULL,
    edited_line     NUMERIC NOT NULL,
    edited_side     TEXT NOT NULL CHECK (edited_side IN ('over', 'under')),
    edited_odds     INTEGER NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, pick_key)
);

ALTER TABLE user_prop_edits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own prop edits"
    ON user_prop_edits FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own prop edits"
    ON user_prop_edits FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own prop edits"
    ON user_prop_edits FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own prop edits"
    ON user_prop_edits FOR DELETE
    USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION set_user_prop_edits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_prop_edits_set_updated_at ON user_prop_edits;
CREATE TRIGGER user_prop_edits_set_updated_at
    BEFORE UPDATE ON user_prop_edits
    FOR EACH ROW
    EXECUTE FUNCTION set_user_prop_edits_updated_at();
