-- Subscribers -- free-account signups captured from static/signup.html.
--
-- This table is owned by SportsWeb, not SportsAnalytics: unlike
-- predictions/latest_predictions (written by SportsAnalytics's File 58,
-- read-only here), SportsWeb is the only thing that ever writes to this
-- one. It just happens to live in the same Postgres database because
-- future features (e.g. "notify me when my favorite team's win
-- probability changes") need to join subscriber rows against
-- latest_predictions, and that's far simpler within one database than
-- across two.
--
-- Run once against the database DATABASE_URL points at:
--   psql "$DATABASE_URL" -f sql/001_subscribers_schema.sql

CREATE TABLE IF NOT EXISTS subscribers (
    id                  BIGSERIAL PRIMARY KEY,
    first_name          TEXT NOT NULL,
    middle_name         TEXT,
    last_name           TEXT NOT NULL,
    email               TEXT NOT NULL UNIQUE,
    cell                TEXT,
    city                TEXT,
    state               TEXT,
    zip                 TEXT,
    favorite_team       TEXT,
    notify_win_prob     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
