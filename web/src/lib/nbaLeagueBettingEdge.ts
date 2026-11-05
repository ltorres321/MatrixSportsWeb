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
// week -- on every cache miss (~26s from the VM, ~11s in the page's own
// estimate, hitting Supabase repeatedly). Two problems: it was slow, and
// ranking a whole week meant the "best" parlays were mostly built from
// games already played (26 of the top 30 picks were already graded on a
// Wednesday), burying today's slate.
//
// Now it only READS public.nba_league_parlay_picks, which
// SportsAnalytics's src4/41_build_nba_league_parlay_picks.py rebuilds
// hourly (right after the :15 prop refresh) for games that haven't started
// and tip within the next 72 hours -- the heavy query lives there now (see
// sql/017 in that repo). Reads are milliseconds. game_date > now() is
// re-applied here so a game that tips off between hourly rebuilds drops out
// immediately instead of lingering until the next one.
//
// hide_banned selects the snapshot variant: TRUE = tonybet/stoiximan/bet99
// excluded (the page default), FALSE = included -- the toggle changes which
// book is best-priced per pick, so the job stores both.

export async function getNbaLeagueParlayPicks(
  hideBannedBooks: boolean = true,
): Promise<{ picks: NbaParlayPick[]; builtAt: string | null }> {
  const rows = await query<{
    player_name: string; team: string; opponent: string; stat: string;
    line: number; side: string; projection: number; cover_probability: number;
    bookmaker: string; price: number; generated_at: Date | string;
    game_date: Date | string; p_rank: string | number; built_at: Date | string;
  }>(
    `SELECT player_name, team, opponent, stat, line, side, projection, cover_probability,
            bookmaker, price, generated_at, game_date, p_rank, built_at
       FROM public.nba_league_parlay_picks
      WHERE hide_banned = $1 AND game_date > now()
      ORDER BY p_rank ASC`,
    [hideBannedBooks],
  );

  const picks = rows.map((r) => ({
    playerName: r.player_name,
    team: r.team,
    opponent: r.opponent,
    stat: r.stat,
    line: r.line,
    side: r.side as "over" | "under",
    projection: r.projection,
    coverProbability: r.cover_probability,
    pRank: r.p_rank == null ? null : Number(r.p_rank),
    // Upcoming games only -- nothing to grade yet.
    pickResult: null,
    actualValue: null,
    bookmaker: r.bookmaker,
    price: r.price,
    oddsAsOf: r.generated_at ? new Date(r.generated_at).toISOString() : null,
    gameDay: r.game_date ? gameDayAbbrev(new Date(r.game_date)) : null,
  }));

  return { picks, builtAt: rows[0]?.built_at ? new Date(rows[0].built_at).toISOString() : null };
}
