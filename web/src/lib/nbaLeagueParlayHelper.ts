import { americanToDecimal, bestParlay, type NbaParlay, type NbaParlayLeg, type NbaParlayPick } from "@/lib/nbaParlayHelper";

// League-wide counterpart to nbaParlayHelper.ts's buildGameParlays -- same
// pure leg/parlay math (americanToDecimal, bestParlay reused as-is), but
// drawn from EVERY game in a Sunday-to-Sunday week (nbaLeagueBettingEdge.ts)
// instead of one game's own top 10. Backs the "Parlays" page's NBA tab
// (app/parlays/nba), the NBA sibling of leagueParlayHelper.ts (NFL).

// A 3-leg parlay only uses legs within the week's own top
// LEAGUE_THREE_LEG_PRANK_CAP (by pick.pRank, league-wide here) -- NOT a
// fixed probability floor, same "scale-invariant" reasoning as
// nbaParlayHelper.ts's own THREE_LEG_PRANK_CAP. Scaled up from the
// per-game cap of 5 by roughly how much bigger a week's slate is than one
// game's top-10 pool: an NBA week (Sun-Sun) runs ~45-55 games, about 3x
// NFL's own per-week slate (~16) that leagueParlayHelper.ts scaled its
// cap of 5 up to 30 for -- same multiple applied here (5 -> 90) rather
// than reusing NFL's literal 30, since NBA's weekly pool of eligible
// props is proportionally larger. Not a precise ratio, just a generous
// multiple of the per-game cap -- revisit if it ever feels too loose or
// too tight in practice.
export const LEAGUE_THREE_LEG_PRANK_CAP = 90;

// Same 4+2=6 total bets as leagueParlayHelper.ts (NFL). Design rule: the
// 3-leg count must never exceed the 2-leg count -- see that file's own
// comment.
export const LEAGUE_TWO_LEG_COUNT = 4;
export const LEAGUE_THREE_LEG_COUNT = 2;

export interface NbaLeagueParlays {
  // Up to LEAGUE_TWO_LEG_COUNT bets, each using the next-best legs after
  // the ones before it.
  twoLeg: NbaParlay[];
  // Up to LEAGUE_THREE_LEG_COUNT bets, same "next-best, no repeats"
  // relationship to each other as twoLeg. Can be fewer if not enough
  // distinct players have a leg within LEAGUE_THREE_LEG_PRANK_CAP.
  threeLeg: NbaParlay[];
}

// Unlike nbaParlayHelper.ts's (private) toLeg, there's no per-game
// pRank<=PARLAY_POOL_SIZE cap -- "best of the best, league-wide" is the
// whole point here, so every scored pick is eligible, ranked purely by
// the model's own probability.
function toLeagueLeg(pick: NbaParlayPick): NbaParlayLeg | null {
  if (pick.bookmaker == null || pick.price == null) return null;
  return {
    pick,
    probability: pick.coverProbability,
    decimalOdds: americanToDecimal(pick.price),
    sportsbook: pick.bookmaker,
    odds: pick.price,
  };
}

// Best `count`-leg parlay from `pool`, excluding any leg already in `used`.
function nextBestParlay(pool: NbaParlayLeg[], used: Set<NbaParlayLeg>, count: number): NbaParlay | null {
  return bestParlay(pool.filter((leg) => !used.has(leg)), count);
}

export function buildNbaLeagueParlays(picks: NbaParlayPick[]): NbaLeagueParlays {
  const pool = picks
    .map(toLeagueLeg)
    .filter((leg): leg is NbaParlayLeg => leg !== null)
    .sort((a, b) => b.probability - a.probability);

  const twoLeg: NbaParlay[] = [];
  const twoLegUsed = new Set<NbaParlayLeg>();
  for (let i = 0; i < LEAGUE_TWO_LEG_COUNT; i++) {
    const parlay = nextBestParlay(pool, twoLegUsed, 2);
    if (!parlay) break;
    twoLeg.push(parlay);
    for (const leg of parlay.legs) twoLegUsed.add(leg);
  }

  const threeLegPool = pool.filter(
    (leg) => leg.pick.pRank != null && leg.pick.pRank <= LEAGUE_THREE_LEG_PRANK_CAP,
  );
  const threeLeg: NbaParlay[] = [];
  const threeLegUsed = new Set<NbaParlayLeg>();
  for (let i = 0; i < LEAGUE_THREE_LEG_COUNT; i++) {
    const parlay = nextBestParlay(threeLegPool, threeLegUsed, 3);
    if (!parlay) break;
    threeLeg.push(parlay);
    for (const leg of parlay.legs) threeLegUsed.add(leg);
  }

  return { twoLeg, threeLeg };
}
