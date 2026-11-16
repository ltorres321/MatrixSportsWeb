-- "My Bookies" (2026-11-13): lets a user pick which real-money
-- sportsbooks they actually have accounts at. Same TEXT[]
-- multi-value pattern as notify_teams (sql/007) -- NOT NULL DEFAULT
-- '{}', so an empty array is the natural "no restriction set yet"
-- state (show everything, same as today) rather than a separate NULL
-- case to handle everywhere this gets read.
--
-- Not part of handle_new_user: unlike favorite_team/favorite_nba_team,
-- there's no signup-form field for this yet, so every new row just
-- gets the column default and the user sets it later from /profile.
--
-- SANDBOX ONLY -- not yet run against the live database. Apply with:
--   psql "$DATABASE_URL" -f sql/017_enabled_sportsbooks.sql

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS enabled_sportsbooks TEXT[] NOT NULL DEFAULT '{}';
