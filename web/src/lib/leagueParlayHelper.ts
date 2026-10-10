import type { PlayerPropEntry } from "@/lib/pffBettingEdge";
import {
  americanToDecimal,
  pickBestPrice,
  bestParlay,
  type Parlay,
  type ParlayLeg,
  type ParlayBookMode,
} from "@/lib/parlayHelper";

// League-wide counterpart to parlayHelper.ts's buildGameParlays -- same
// pure legs/parlay math (americanToDecimal, pickBestPrice, makeParlay,
// pickDistinctPlayers, bestParlay, all reused as-is), but drawn from
// EVERY game in a week (getLeagueBettingEdge) instead of one game's own
// top 10. Backs the "Parlays" page (app/parlays), the league-wide
// sibling of the per-game "Parlay Helper" tab.

// A 3-leg parlay only uses legs within the week's own top
// LEAGUE_THREE_LEG_PRANK_CAP (by entry.pRank, league-wide here -- see
// getLeagueBettingEdge) -- NOT a fixed probability floor. Same
// "scale-invariant, not scale-dependent" reasoning as
// parlayHelper.ts's THREE_LEG_PRANK_CAP (see that constant's own
// comment for the 2026-10 incident this replaced). Scaled up from the
// per-game cap of 5 (out of a 10-prop pool) for a week with roughly
// 3x as many games/props in play -- not a precise ratio, just "a
// generous multiple of the per-game cap," revisit if it ever feels too
// loose or too tight in practice.
export const LEAGUE_THREE_LEG_PRANK_CAP = 30;

// 6 bets total (2026-10: bumped from 3+2=5 to fill out the page).
// Design rule: the 3-leg count must never exceed the 2-leg count --
// a 3-leg parlay is the longer shot of the two, so this page should
// never offer more of the riskier bet than the safer one. If either
// count changes again, keep LEAGUE_THREE_LEG_COUNT <= LEAGUE_TWO_LEG_COUNT.
export const LEAGUE_TWO_LEG_COUNT = 4;
export const LEAGUE_THREE_LEG_COUNT = 2;

export interface LeagueParlays {
  // Up to LEAGUE_TWO_LEG_COUNT bets, each using the next-best legs
  // after the ones before it -- "2-Leg Parlay 1/2/3/4" are genuinely
  // different bets, not overlapping slips of the same two picks.
  twoLeg: Parlay[];
  // Up to LEAGUE_THREE_LEG_COUNT bets, same "next-best, no repeats"
  // relationship to each other as twoLeg -- independently built from
  // the full pool (not excluding twoLeg's own legs), same relationship
  // buildGameParlays' single threeLeg has to its twoLeg today. Any of
  // these can be missing if fewer than 3 distinct players have a leg
  // within LEAGUE_THREE_LEG_PRANK_CAP.
  threeLeg: Parlay[];
}

// Unlike parlayHelper.ts's toLeg, there's no per-game pRank<=10 pool cap --
// "best of the best, league-wide" is the whole point here, so every scored
// prop is eligible, ranked purely by the model's own probability.
function toLeagueLeg(entry: PlayerPropEntry): ParlayLeg | null {
  if (entry.modelProbability == null || Number.isNaN(entry.modelProbability)) return null;
  const price = pickBestPrice(entry);
  if (!price) return null;
  return {
    entry,
    probability: entry.modelProbability,
    decimalOdds: americanToDecimal(price.odds),
    ...price,
  };
}

// Best `count`-leg parlay from `pool`, excluding any leg already in `used`.
function nextBestParlay(
  pool: ParlayLeg[],
  used: Set<ParlayLeg>,
  count: number,
  mode: ParlayBookMode,
): Parlay | null {
  return bestParlay(
    pool.filter((leg) => !used.has(leg)),
    count,
    mode,
  );
}

export function buildLeagueParlays(
  playerProps: PlayerPropEntry[],
  mode: ParlayBookMode = "single",
): LeagueParlays {
  const pool = playerProps
    .map(toLeagueLeg)
    .filter((leg): leg is ParlayLeg => leg !== null)
    .sort((a, b) => b.probability - a.probability);

  const twoLeg: Parlay[] = [];
  const twoLegUsed = new Set<ParlayLeg>();
  for (let i = 0; i < LEAGUE_TWO_LEG_COUNT; i++) {
    const parlay = nextBestParlay(pool, twoLegUsed, 2, mode);
    if (!parlay) break;
    twoLeg.push(parlay);
    for (const leg of parlay.legs) twoLegUsed.add(leg);
  }

  const threeLegPool = pool.filter(
    (leg) => leg.entry.pRank != null && leg.entry.pRank <= LEAGUE_THREE_LEG_PRANK_CAP,
  );
  const threeLeg: Parlay[] = [];
  const threeLegUsed = new Set<ParlayLeg>();
  for (let i = 0; i < LEAGUE_THREE_LEG_COUNT; i++) {
    const parlay = nextBestParlay(threeLegPool, threeLegUsed, 3, mode);
    if (!parlay) break;
    threeLeg.push(parlay);
    for (const leg of parlay.legs) threeLegUsed.add(leg);
  }

  return { twoLeg, threeLeg };
}
