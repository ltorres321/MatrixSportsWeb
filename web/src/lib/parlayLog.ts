import "server-only";
import { createHash } from "node:crypto";
import { query } from "@/lib/db";
import type { GameParlays, Parlay, ParlayBookMode } from "@/lib/parlayHelper";
import type { LeagueParlays } from "@/lib/leagueParlayHelper";

// Records every parlay the Parlay Helper tab shows into public.site_parlay_log
// (see sql/012_site_parlay_log.sql for the why). Called from
// getGameBettingEdge, i.e. on the server before the page renders, with the
// SAME parlay objects the page then displays.

// Where each leg's odds come from, and how to find their history. A leg is
// priced at whichever of PFF's own pick or a matching-line book from
// player_prop_lines paid more (parlayHelper.ts's pickBestPrice) -- odds_source
// records which one actually won for THIS leg, so the audit trail points at
// the right history table: etl.odds_audit_log for "pff", else
// etl.player_prop_lines_history.
function legSnapshot(leg: Parlay["legs"][number]) {
  const e = leg.entry;
  return {
    player: e.playerName,
    team: e.playerTeam,
    stat: e.consensusStat,
    side: e.pickSide,
    line: e.pickLine,
    odds: leg.odds,
    sportsbook: leg.sportsbook,
    probability: leg.probability,
    pRank: e.pRank,
    overallRank: e.overallRank,
    odds_source: leg.oddsSource === "pff" ? "etl.pff_player_props" : "etl.player_prop_lines",
    odds_as_of: leg.oddsAsOf,
  };
}

// Hash covers exactly what a reader would see change: which legs, at what
// line/odds/book. Probabilities and ranks are stored but not hashed, so a
// model re-run doesn't mint a "new" parlay out of identical odds.
function parlayHash(gameId: string, mode: ParlayBookMode, legs: ReturnType<typeof legSnapshot>[]) {
  const identity = legs.map((l) => [l.player, l.stat, l.side, l.line, l.odds, l.sportsbook]);
  return createHash("sha256").update(JSON.stringify([gameId, mode, identity])).digest("hex");
}

export async function recordDisplayedParlays(
  gameId: string,
  parlaysByMode: Record<ParlayBookMode, GameParlays>,
): Promise<void> {
  const rows = new Map<string, unknown[]>();
  for (const mode of ["single", "mixed"] as const) {
    const { twoLeg, threeLeg } = parlaysByMode[mode];
    for (const parlay of [...twoLeg, ...(threeLeg ? [threeLeg] : [])]) {
      const legs = parlay.legs.map(legSnapshot);
      const hash = parlayHash(gameId, mode, legs);
      rows.set(hash, [
        hash,
        gameId,
        mode,
        legs.length,
        parlay.sportsbook,
        parlay.probability,
        parlay.decimalOdds,
        JSON.stringify(legs),
      ]);
    }
  }
  if (rows.size === 0) return;

  const values: unknown[] = [];
  const placeholders = [...rows.values()].map((row, i) => {
    values.push(...row);
    const o = i * 8;
    return `($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5}, $${o + 6}, $${o + 7}, $${o + 8}::jsonb)`;
  });

  await query(
    `INSERT INTO public.site_parlay_log AS t
       (parlay_hash, universal_game_id, mode, leg_count, sportsbook, parlay_probability, payout_per_dollar, legs)
     VALUES ${placeholders.join(", ")}
     ON CONFLICT (parlay_hash) DO UPDATE SET
       last_shown_at = now(),
       times_shown = t.times_shown + 1`,
    values,
  );
}

// League-wide counterpart to recordDisplayedParlays/legSnapshot above,
// for the "Parlays" page (app/parlays) -- same legSnapshot shape, same
// "DO NOT touch the odds, just hash + log what's shown" contract, keyed
// by season+week (see sql/013_site_league_parlay_log.sql) instead of
// universal_game_id since a league-wide parlay's legs can span several
// games.
function leagueParlayHash(season: number, week: number, mode: ParlayBookMode, legs: ReturnType<typeof legSnapshot>[]) {
  const identity = legs.map((l) => [l.player, l.stat, l.side, l.line, l.odds, l.sportsbook]);
  return createHash("sha256").update(JSON.stringify([season, week, mode, identity])).digest("hex");
}

export async function recordDisplayedLeagueParlays(
  season: number,
  week: number,
  parlaysByMode: Record<ParlayBookMode, LeagueParlays>,
): Promise<void> {
  const rows = new Map<string, unknown[]>();
  for (const mode of ["single", "mixed"] as const) {
    const { twoLeg, threeLeg } = parlaysByMode[mode];
    for (const parlay of [...twoLeg, ...threeLeg]) {
      const legs = parlay.legs.map(legSnapshot);
      const hash = leagueParlayHash(season, week, mode, legs);
      rows.set(hash, [
        hash,
        season,
        week,
        mode,
        legs.length,
        parlay.sportsbook,
        parlay.probability,
        parlay.decimalOdds,
        JSON.stringify(legs),
      ]);
    }
  }
  if (rows.size === 0) return;

  const values: unknown[] = [];
  const placeholders = [...rows.values()].map((row, i) => {
    values.push(...row);
    const o = i * 9;
    return `($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5}, $${o + 6}, $${o + 7}, $${o + 8}, $${o + 9}::jsonb)`;
  });

  await query(
    `INSERT INTO public.site_league_parlay_log AS t
       (parlay_hash, season, week, mode, leg_count, sportsbook, parlay_probability, payout_per_dollar, legs)
     VALUES ${placeholders.join(", ")}
     ON CONFLICT (parlay_hash) DO UPDATE SET
       last_shown_at = now(),
       times_shown = t.times_shown + 1`,
    values,
  );
}
