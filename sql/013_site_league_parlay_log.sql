-- ------------------------------------------------------------------
-- site_league_parlay_log -- every distinct parlay the league-wide
-- "Parlays" page has shown, with the exact odds it used.
--
-- WHY: same reasoning as site_parlay_log (sql/012) -- every odds value
-- the site displays has to be saved with a timestamp so "what did we
-- show, and how fresh was it?" is always answerable. A separate table
-- rather than reusing site_parlay_log because a league-wide parlay
-- isn't scoped to one universal_game_id (its legs can come from
-- several different games in the same week) -- season+week is the
-- natural key here instead. web/src/app/parlays/page.tsx builds each
-- week's parlays on the SERVER and records them here
-- (web/src/lib/parlayLog.ts's recordDisplayedLeagueParlays) before the
-- page renders them -- the page reads those same objects, so what was
-- displayed and what was logged cannot differ.
--
-- One row per distinct parlay (parlay_hash = SHA-256 of season + week +
-- mode + each leg's player/stat/side/line/odds/book). If the odds or
-- legs change, that's a NEW row; re-showing the identical parlay only
-- bumps last_shown_at/times_shown.
--
-- legs (JSONB) per leg: player, team, stat, side, line, odds (American),
-- sportsbook, probability (model's chance the leg hits), pRank,
-- overallRank, odds_source (which table the odds came from) and
-- odds_as_of (when that source row was last refreshed) -- same shape
-- parlayLog.ts's legSnapshot already produces for site_parlay_log.
--
-- Run once against the shared database:
--   psql "$DATABASE_URL" -f sql/013_site_league_parlay_log.sql
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.site_league_parlay_log (
    parlay_hash         TEXT PRIMARY KEY,
    season              INTEGER NOT NULL,
    week                INTEGER NOT NULL,
    mode                TEXT NOT NULL,            -- 'single' (one book) | 'mixed'
    leg_count           INTEGER NOT NULL,
    sportsbook          TEXT,                     -- the one book, when single
    parlay_probability  DOUBLE PRECISION NOT NULL,
    payout_per_dollar   DOUBLE PRECISION NOT NULL, -- total returned on a $1 bet, stake included
    legs                JSONB NOT NULL,
    first_shown_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_shown_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    times_shown         BIGINT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_site_league_parlay_log_week
    ON public.site_league_parlay_log (season, week, first_shown_at);
