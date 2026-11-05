import "server-only";
import { query } from "@/lib/db";
import { gameDayAbbrev } from "@/lib/schedule";
import type { NbaParlayPick } from "@/lib/nbaParlayHelper";

// League-wide pick pool for the "Parlays" page's NBA tab (app/parlays/nba),
// the NBA sibling of pffBettingEdge.ts's getLeagueBettingEdge.
//
// CHANGED 2026-11-05: this used to run the full ranking live -- a
// freshness-filtered, best-book-per-pick, league-wide-pRank query over
// nba_player_prop_predictions (500k+ rows) for a whole Sunday-Saturday
// week -- on every cache miss (~26s, hitting Supabase repeatedly). Now it
// only READS public.nba_league_parlay_picks, which SportsAnalytics's
// src4/41_build_nba_league_parlay_picks.py rebuilds hourly (see sql/017 and
// sql/018 in that repo for the full why). Reads are milliseconds.
//
// The table holds the current Sunday-Saturday ET week split by ET day
// (game_day), each day ranked on its own (p_rank is per day). A day's rows
// are rebuilt hourly until its first game tips off, then FROZEN -- so the
// parlays built from them page-side are "the ones the model found" that
// day -- and pick_result/actual_value are filled in as games are graded.
//
// hide_banned selects the snapshot variant: TRUE = tonybet/stoiximan/bet99
// excluded (the page default), FALSE = included -- the toggle changes which
// book is best-priced per pick, so the job stores both.

// A pick plus the ET calendar day ("YYYY-MM-DD") whose pool it belongs to.
export type NbaDayPick = NbaParlayPick & { dayKey: string };

export async function getNbaLeagueParlayPicks(
  hideBannedBooks: boolean,
  weekStart: string, // "YYYY-MM-DD", ET calendar date, inclusive
  weekEndExclusive: string, // "YYYY-MM-DD", ET calendar date, exclusive
): Promise<{ picks: NbaDayPick[]; builtAt: string | null }> {
  const rows = await query<{
    player_name: string; team: string; opponent: string; stat: string;
    line: number; side: string; projection: number; cover_probability: number;
    bookmaker: string; price: number; generated_at: Date | string;
    game_date: Date | string; p_rank: string | number; built_at: Date | string;
    day_key: string; pick_result: string | null; actual_value: number | null;
  }>(
    `SELECT player_name, team, opponent, stat, line, side, projection, cover_probability,
            bookmaker, price, generated_at, game_date, p_rank, built_at,
            to_char(game_day, 'YYYY-MM-DD') AS day_key, pick_result, actual_value
       FROM public.nba_league_parlay_picks
      WHERE hide_banned = $1 AND game_day >= $2::date AND game_day < $3::date
      ORDER BY game_day, p_rank ASC`,
    [hideBannedBooks, weekStart, weekEndExclusive],
  );

  const picks = rows.map((r) => ({
    dayKey: r.day_key,
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

  // Most recent job write across the week (frozen days keep older built_at).
  const builtAtMs = rows.reduce((max, r) => Math.max(max, new Date(r.built_at).getTime()), 0);

  return { picks, builtAt: builtAtMs ? new Date(builtAtMs).toISOString() : null };
}
