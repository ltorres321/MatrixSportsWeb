-- Site Odds Preference (2026-11-16): lets a user choose how odds display
-- across the site -- American (default), Decimal, or Fractional. Plain
-- TEXT + CHECK constraint, same style as this table's other columns (no
-- custom enum type used elsewhere here).
--
-- SANDBOX ONLY -- not yet run against the live database. Apply with:
--   psql "$DATABASE_URL" -f sql/019_odds_format.sql

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS odds_format TEXT NOT NULL DEFAULT 'american'
  CHECK (odds_format IN ('american', 'decimal', 'fractional'));
