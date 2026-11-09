-- Stores the "model record at X% confidence" tiles' win/loss counts
-- (home dashboard, NFL and NBA) -- a small derived summary over
-- latest_predictions/latest_nba_predictions, refreshed periodically by
-- a Netlify scheduled function (netlify/functions/refresh-confidence-
-- records.mts) rather than recomputed on every page load. User,
-- 2026-11-09: "these records should not change too often so these
-- games should be stored in a table for fast access."
--
-- One row per (league, season, min_prob) -- today that's 2 leagues x
-- 1 current season x 2 thresholds (0.70/0.80) = 4 rows, but nothing
-- here assumes exactly that.
--
-- Run once against the database DATABASE_URL points at:
--   psql "$DATABASE_URL" -f sql/016_confidence_record_cache.sql

CREATE TABLE IF NOT EXISTS confidence_record_cache (
    league       TEXT NOT NULL CHECK (league IN ('nfl', 'nba')),
    season       INTEGER NOT NULL,
    min_prob     NUMERIC(3, 2) NOT NULL,
    wins         INTEGER NOT NULL,
    losses       INTEGER NOT NULL,
    computed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (league, season, min_prob)
);
