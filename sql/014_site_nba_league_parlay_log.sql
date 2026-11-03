-- ------------------------------------------------------------------
-- site_nba_league_parlay_log -- every distinct parlay the NBA tab of
-- the league-wide "Parlays" page (app/parlays/nba) has shown, with the
-- exact odds it used.
--
-- WHY: same reasoning as site_league_parlay_log (sql/013) -- every
-- odds value the site displays has to be saved with a timestamp so
-- "what did we show, and how fresh was it?" is always answerable. A
-- separate table rather than reusing sql/013's because NBA has no
-- season/week numbering to key on -- app/parlays/nba shows a
-- Sunday-to-Sunday window instead (nbaSchedule.ts's getCurrentNbaWeek),
-- so week_start (that window's Sunday, ET calendar date) is the natural
-- key here. Also no "mode" column -- NBA parlays are deliberately
-- single-book-only (see nbaParlayHelper.ts's module header), so there's
-- no "mixed" variant to record alongside it the way NFL's table does.
-- web/src/app/parlays/nba/page.tsx builds each week's parlays on the
-- SERVER and records them here (web/src/lib/parlayLog.ts's
-- recordDisplayedNbaLeagueParlays) before the page renders them -- the
-- page reads those same objects, so what was displayed and what was
-- logged cannot differ.
--
-- One row per distinct parlay (parlay_hash = SHA-256 of week_start +
-- each leg's player/stat/side/line/odds/book). If the odds or legs
-- change, that's a NEW row; re-showing the identical parlay only bumps
-- last_shown_at/times_shown.
--
-- legs (JSONB) per leg: player, team, stat, side, line, odds (American),
-- sportsbook, probability (model's chance the leg hits), pRank, and
-- odds_as_of (when that pick's price was last refreshed) -- same shape
-- parlayLog.ts's nbaLegSnapshot produces.
--
-- Run once against the shared database:
--   psql "$DATABASE_URL" -f sql/014_site_nba_league_parlay_log.sql
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.site_nba_league_parlay_log (
    parlay_hash         TEXT PRIMARY KEY,
    week_start          DATE NOT NULL,              -- the window's Sunday, ET calendar date
    leg_count           INTEGER NOT NULL,
    sportsbook          TEXT,                       -- the one book every leg is priced at
    parlay_probability  DOUBLE PRECISION NOT NULL,
    payout_per_dollar   DOUBLE PRECISION NOT NULL,   -- total returned on a $1 bet, stake included
    legs                JSONB NOT NULL,
    first_shown_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_shown_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    times_shown         BIGINT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_site_nba_league_parlay_log_week
    ON public.site_nba_league_parlay_log (week_start, first_shown_at);
