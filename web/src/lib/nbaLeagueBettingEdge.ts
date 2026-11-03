import "server-only";
import { query } from "@/lib/db";
import { gameDayAbbrev } from "@/lib/schedule";
import { BANNED_US_BOOKS, NON_RETAIL_BOOKS } from "@/lib/pffBettingEdge";
import { MIN_DISPLAYED_EDGE } from "@/lib/nbaGameDetail";
import type { NbaParlayPick } from "@/lib/nbaParlayHelper";

// League-wide counterpart to nbaGameDetail.ts's parlayPickRows query --
// same freshness-filtered, best-book-per-pick, pRank-over-the-pool shape,
// just scoped to every game across a Sunday-to-Sunday window
// (nbaSchedule.ts's getCurrentNbaWeek) instead of one universal_game_id.
// Backs the league-wide "Parlays" page's NBA tab (app/parlays/nba),
// the NBA sibling of pffBettingEdge.ts's getLeagueBettingEdge.

export async function getNbaLeagueParlayPicks(
  weekStart: string, // "YYYY-MM-DD", ET calendar date, inclusive
  weekEndExclusive: string, // "YYYY-MM-DD", ET calendar date, exclusive
  hideBannedBooks: boolean = true,
): Promise<NbaParlayPick[]> {
  const excludedParlayBooks = [...NON_RETAIL_BOOKS, ...(hideBannedBooks ? BANNED_US_BOOKS : [])];

  const rows = await query<{
    player_name: string; team: string; opponent: string; stat: string;
    line: number; side: string; projection: number; cover_probability: number;
    pick_result: string | null; actual_value: number | null;
    bookmaker: string; price: number; generated_at: Date | string;
    game_date: Date | string;
    p_rank: string | number;
  }>(
    `WITH week_games AS (
       -- The small (a few thousand rows), already-"latest per game" view
       -- -- fine to use directly, unlike latest_nba_player_prop_predictions
       -- below. latest_nba_predictions's own game_date can differ by a few
       -- minutes between model reruns for the same game (a schedule-time
       -- correction, not jitter) -- querying it directly, instead of a
       -- DISTINCT on the raw table, keeps exactly one game_date per game
       -- id so this never fans a leg out into duplicate rows downstream.
       SELECT universal_game_id, game_date
         FROM latest_nba_predictions
        WHERE (game_date AT TIME ZONE 'America/New_York')::date >= $1::date
          AND (game_date AT TIME ZONE 'America/New_York')::date < $2::date
     ),
     -- Deliberately does NOT read latest_nba_player_prop_predictions --
     -- that view's own internal "latest row" GROUP BY runs over the
     -- WHOLE nba_player_prop_predictions table (500k+ rows and growing)
     -- with no per-game scoping at all (see its definition). Postgres can
     -- push a single constant "universal_game_id = $1" into that GROUP BY
     -- for nbaGameDetail.ts's per-game query, but it can't do the same for
     -- a many-game JOIN -- confirmed live 2026-11-03: using that view here
     -- timed out (>30s) even after scoping everything else to the week's
     -- ~50 games first. MATERIALIZED forces this filtered-and-scoped slice
     -- to be computed exactly once and reused by every CTE below, instead
     -- of Postgres re-running this same join 2-3x for each reference.
     scoped AS MATERIALIZED (
       SELECT p.universal_game_id, p.player_name, p.team, p.opponent, p.stat, p.line, p.side,
              p.bookmaker, p.price, p.generated_at, p.projection, p.cover_probability,
              p.pick_result, p.actual_value
         FROM nba_player_prop_predictions p
         JOIN week_games g ON g.universal_game_id = p.universal_game_id
        WHERE p.edge >= $3 AND p.bookmaker != 'dst_propbuilder'
     ),
     -- Same per-book "only this book's latest poll for this game"
     -- freshness filter as nbaGameDetail.ts's parlayPickRows.
     book_freshness AS (
       SELECT universal_game_id, bookmaker, MAX(generated_at) AS max_book_gen
         FROM scoped
        GROUP BY universal_game_id, bookmaker
     ),
     -- Finds each pick's own latest polled value via GROUP BY + a
     -- join-back on equality, not a DISTINCT ON sort over the full,
     -- wide rowset -- confirmed live this scales far better at this
     -- row count (~100k rows pre-dedup): a plain GROUP BY took ~3s,
     -- the equivalent DISTINCT ON took ~17s for the same input.
     pick_latest AS (
       SELECT universal_game_id, player_name, stat, line, side, bookmaker, MAX(generated_at) AS max_gen
         FROM scoped
        GROUP BY universal_game_id, player_name, stat, line, side, bookmaker
     ),
     fresh AS (
       SELECT s.*
         FROM scoped s
         JOIN pick_latest pl
           ON pl.universal_game_id = s.universal_game_id AND pl.player_name = s.player_name
          AND pl.stat = s.stat AND pl.line = s.line AND pl.side = s.side
          AND pl.bookmaker = s.bookmaker AND pl.max_gen = s.generated_at
         JOIN book_freshness bf
           ON bf.universal_game_id = s.universal_game_id AND bf.bookmaker = s.bookmaker
        WHERE s.generated_at >= bf.max_book_gen - interval '15 minutes'
     ),
     -- Best price per real pick (across books), same "plain > compares
     -- American odds correctly" property parlayHelper.ts's pickBestPrice
     -- relies on for NFL -- MAX(price) finds it without a sort, same
     -- GROUP BY-then-join-back idea as pick_latest above. The final
     -- DISTINCT ON below only runs over this already-tiny,
     -- one-row-per-pick-per-tied-best-price result, not the full pool.
     legs_best AS (
       SELECT universal_game_id, player_name, stat, line, side, MAX(price) AS best_price
         FROM fresh
        WHERE bookmaker != ALL($4::text[])
        GROUP BY universal_game_id, player_name, stat, line, side
     ),
     legs AS (
       SELECT DISTINCT ON (fr.universal_game_id, fr.player_name, fr.stat, fr.line, fr.side)
              fr.universal_game_id, fr.player_name, fr.team, fr.opponent, fr.stat, fr.line, fr.side,
              fr.projection, fr.cover_probability, fr.pick_result, fr.actual_value,
              fr.bookmaker, fr.price, fr.generated_at
         FROM fresh fr
         JOIN legs_best lb
           ON lb.universal_game_id = fr.universal_game_id AND lb.player_name = fr.player_name
          AND lb.stat = fr.stat AND lb.line = fr.line AND lb.side = fr.side AND lb.best_price = fr.price
        WHERE fr.bookmaker != ALL($4::text[])
        ORDER BY fr.universal_game_id, fr.player_name, fr.stat, fr.line, fr.side, fr.bookmaker
     ),
     -- p_rank is computed over the FULL week's pool (every game), not
     -- per-game -- same "best of the best, league-wide" idea as
     -- pffBettingEdge.ts's getLeagueBettingEdge.
     ranked AS (
       SELECT universal_game_id, player_name, stat, line, side, MAX(cover_probability) AS cover_probability
         FROM fresh
        GROUP BY universal_game_id, player_name, stat, line, side
     ),
     pr AS (
       SELECT universal_game_id, player_name, stat, line, side,
              ROW_NUMBER() OVER (ORDER BY cover_probability DESC) AS p_rank
         FROM ranked
     )
     SELECT legs.*, g.game_date, pr.p_rank
       FROM legs
       JOIN pr ON pr.universal_game_id = legs.universal_game_id AND pr.player_name = legs.player_name
              AND pr.stat = legs.stat AND pr.line = legs.line AND pr.side = legs.side
       JOIN week_games g ON g.universal_game_id = legs.universal_game_id
      ORDER BY pr.p_rank ASC`,
    [weekStart, weekEndExclusive, MIN_DISPLAYED_EDGE, excludedParlayBooks],
  );

  return rows.map((r) => ({
    playerName: r.player_name,
    team: r.team,
    opponent: r.opponent,
    stat: r.stat,
    line: r.line,
    side: r.side as "over" | "under",
    projection: r.projection,
    coverProbability: r.cover_probability,
    pRank: r.p_rank == null ? null : Number(r.p_rank),
    pickResult: r.pick_result,
    actualValue: r.actual_value,
    bookmaker: r.bookmaker,
    price: r.price,
    oddsAsOf: r.generated_at ? new Date(r.generated_at).toISOString() : null,
    gameDay: r.game_date ? gameDayAbbrev(new Date(r.game_date)) : null,
  }));
}
