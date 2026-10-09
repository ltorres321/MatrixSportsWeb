import type { PlayerPropEntry } from "@/lib/pffBettingEdge";
import {
  americanToDecimal,
  pickBestPrice,
  bestParlay,
  MIN_THREE_LEG_LEG_PROBABILITY,
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

export interface LeagueParlays {
  // 3 bets, each using the next-best legs after the ones before it --
  // "2-Leg Parlay 1/2/3" are genuinely different bets, not overlapping
  // slips of the same two picks.
  twoLeg: Parlay[];
  // Up to 2 bets, same "next-best, no repeats" relationship to each
  // other as twoLeg -- independently built from the full pool (not
  // excluding twoLeg's own legs), same relationship buildGameParlays'
  // single threeLeg has to its twoLeg today. Either or both can be
  // missing if fewer than 3 distinct players clear
  // MIN_THREE_LEG_LEG_PROBABILITY.
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
  minLegProbability = 0,
): Parlay | null {
  return bestParlay(
    pool.filter((leg) => !used.has(leg)),
    count,
    mode,
    minLegProbability,
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
  for (let i = 0; i < 3; i++) {
    const parlay = nextBestParlay(pool, twoLegUsed, 2, mode);
    if (!parlay) break;
    twoLeg.push(parlay);
    for (const leg of parlay.legs) twoLegUsed.add(leg);
  }

  const threeLeg: Parlay[] = [];
  const threeLegUsed = new Set<ParlayLeg>();
  for (let i = 0; i < 2; i++) {
    const parlay = nextBestParlay(pool, threeLegUsed, 3, mode, MIN_THREE_LEG_LEG_PROBABILITY);
    if (!parlay) break;
    threeLeg.push(parlay);
    for (const leg of parlay.legs) threeLegUsed.add(leg);
  }

  return { twoLeg, threeLeg };
}
