-- ------------------------------------------------------------------
-- site_parlay_log -- every distinct parlay the site's Parlay Helper tab
-- has shown, with the exact odds it used.
--
-- WHY: every odds value the site displays has to be saved with a
-- timestamp so "what did we show, and how fresh was it?" is always
-- answerable. web/src/lib/pffBettingEdge.ts builds each game's parlays
-- on the SERVER and records them here (web/src/lib/parlayLog.ts) before
-- the page renders them -- the page reads those same objects, so what
-- was displayed and what was logged cannot differ.
--
-- One row per distinct parlay (parlay_hash = SHA-256 of mode + each
-- leg's player/stat/side/line/odds/book). If the odds or legs change,
-- that's a NEW row; re-showing the identical parlay only bumps
-- last_shown_at/times_shown (a count of server RENDERS -- one page view
-- can render more than once, since the page and its metadata both load
-- the game). So first_shown_at..last_shown_at is the window during
-- which exactly these numbers were on the site.
--
-- legs (JSONB) per leg: player, team, stat, side, line, odds (American),
-- sportsbook, probability (model's chance the leg hits), pRank,
-- overallRank, odds_source (which table the odds came from) and
-- odds_as_of (when that source row was last refreshed). The odds
-- themselves also live in their own source tables' histories:
-- etl.odds_audit_log (PFF tables) and etl.player_prop_lines_history.
--
-- Run once against the shared database:
--   psql "$DATABASE_URL" -f sql/012_site_parlay_log.sql
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.site_parlay_log (
    parlay_hash         TEXT PRIMARY KEY,
    universal_game_id   TEXT NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_site_parlay_log_game
    ON public.site_parlay_log (universal_game_id, first_shown_at);
