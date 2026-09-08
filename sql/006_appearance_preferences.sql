-- Appearance preferences for the Profile page's new "Matrix Mode"
-- (rain effect on/off) and Light/Dark theme settings. Defaults match
-- the site's existing look, so nothing changes for anyone until they
-- actually open Profile and change something.
--
-- Run once against the database DATABASE_URL points at:
--   psql "$DATABASE_URL" -f sql/006_appearance_preferences.sql

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'dark';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS matrix_rain_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_theme_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_theme_check CHECK (theme IN ('dark', 'light'));
