// NBA per-game Parlay Helper -- same same-game parlay construction as
// parlayHelper.ts (NFL), adapted to NBA's own prop data shape instead
// of sharing PlayerPropEntry. Pure functions, no I/O: legs come in
// already deduped to one row per real pick (player+stat+line+side) and
// ranked by nbaGameDetail.ts's own query (see getNbaGameDetail's
// parlayPicks query for how pRank/the chosen book+price are computed).
//
// Deliberately single-book-only (no NFL-style "mixed" mode): NBA's
// props table already carries every book's own price per pick (see
// sql/009's header -- "ONE ROW PER (player, stat, line, side,
// bookmaker)"), so a same-book combo is almost always findable the same
// way NFL's own ParlayHelperView found mixed-book parlays added more
// confusion than value once book coverage got wide enough -- see that
// component's own comment. Revisit if NBA's book coverage turns out
// thinner in practice.

// "From the top 10 using pRank" -- same cap and same reasoning as
// parlayHelper.ts's PARLAY_POOL_SIZE: only props the model ranks 1-10
// within this game are eligible to be a leg.
export const PARLAY_POOL_SIZE = 10;

// A 3-leg parlay only uses legs from the pool's own strongest half --
// pRank <= THREE_LEG_PRANK_CAP -- not a fixed probability floor. Same
// "scale-invariant, not scale-dependent" reasoning as parlayHelper.ts's
// own THREE_LEG_PRANK_CAP (see that constant's comment for the 2026-10
// incident a probability floor caused there).
export const THREE_LEG_PRANK_CAP = 5;

export interface NbaParlayPick {
  playerName: string;
  team: string;
  opponent: string;
  stat: string;
  line: number;
  side: "over" | "under";
  projection: number;
  // The model's estimated chance this single prop pick hits.
  coverProbability: number;
  // This model's rank of how likely this pick is to be correct, scoped
  // to just this game's own props (1 = most likely, no gaps). Null
  // only if nbaGameDetail.ts's ranking query somehow didn't cover this
  // pick -- not expected in practice since every pick comes from that
  // same query.
  pRank: number | null;
  // "correct" | "incorrect" | null (null pre-game, before src4/40 has
  // graded it).
  pickResult: string | null;
  // The real stat number pickResult was graded against -- null
  // pre-game.
  actualValue: number | null;
  // The best-priced book for this pick among retail, non-banned books
  // (nbaGameDetail.ts's own query already excludes exchanges/DFS and,
  // when the toggle is on, legally-unavailable-to-US-bettors books from
  // this selection) -- null when no such book currently quotes this
  // pick, which drops the leg from the parlay pool entirely (see toLeg
  // below).
  bookmaker: string | null;
  price: number | null;
  oddsAsOf: string | null;
  // "Tue" etc. -- only set by the league-wide query (nbaLeagueBettingEdge.ts),
  // since a per-game pick's matchup is implied by the page you're on
  // (nbaGameDetail.ts's parlayPickRows always sets this null). Lets
  // NbaParlayCard's showMatchup mode label which game/day a leg is from
  // when legs in one parlay can span the whole week's slate.
  gameDay: string | null;
}

export interface NbaParlayLeg {
  pick: NbaParlayPick;
  probability: number;
  // What $1 returns (stake included) if this leg alone wins.
  decimalOdds: number;
  sportsbook: string;
  odds: number;
}

export interface NbaParlay {
  legs: NbaParlayLeg[];
  // The one sportsbook every leg is priced at -- always non-null here
  // since bestParlay only ever builds single-book combos (see module
  // header).
  sportsbook: string | null;
  // Product of the legs' probabilities -- assumes independence, which
  // same-game legs aren't strictly (e.g. a center's points and
  // rebounds move together). Treat as an estimate.
  probability: number;
  // Product of the legs' decimal odds: total returned on a $1 bet,
  // stake included.
  decimalOdds: number;
}

export interface NbaGameParlays {
  twoLeg: NbaParlay[];
  // Null when fewer than three distinct players have a leg within
  // THREE_LEG_PRANK_CAP.
  threeLeg: NbaParlay | null;
}

export function americanToDecimal(odds: number): number {
  return odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds);
}

function toLeg(pick: NbaParlayPick): NbaParlayLeg | null {
  if (pick.pRank == null || pick.pRank > PARLAY_POOL_SIZE) return null;
  if (pick.bookmaker == null || pick.price == null) return null;
  return {
    pick,
    probability: pick.coverProbability,
    decimalOdds: americanToDecimal(pick.price),
    sportsbook: pick.bookmaker,
    odds: pick.price,
  };
}

function makeParlay(legs: NbaParlayLeg[]): NbaParlay {
  const books = new Set(legs.map((l) => l.sportsbook));
  return {
    legs,
    sportsbook: books.size === 1 ? [...books][0] : null,
    probability: legs.reduce((p, l) => p * l.probability, 1),
    decimalOdds: legs.reduce((d, l) => d * l.decimalOdds, 1),
  };
}

// Walks the candidates best-first and takes the first `count` legs that
// belong to distinct players: two legs on the same player (his points
// and his PRA, say) are close to the same bet twice and would overstate
// the parlay's probability.
function pickDistinctPlayers(candidates: NbaParlayLeg[], count: number): NbaParlayLeg[] | null {
  const picked: NbaParlayLeg[] = [];
  const players = new Set<string>();
  for (const leg of candidates) {
    if (players.has(leg.pick.playerName)) continue;
    players.add(leg.pick.playerName);
    picked.push(leg);
    if (picked.length === count) return picked;
  }
  return null;
}

// Best `count`-leg parlay from `pool` (already sorted best-first): builds
// the best same-book combo available at each sportsbook and keeps the
// most likely one. Legs with no known sportsbook never reach this pool
// (toLeg already drops them).
export function bestParlay(pool: NbaParlayLeg[], count: number): NbaParlay | null {
  const byBook = new Map<string, NbaParlayLeg[]>();
  for (const leg of pool) {
    byBook.set(leg.sportsbook, [...(byBook.get(leg.sportsbook) ?? []), leg]);
  }

  let best: NbaParlay | null = null;
  for (const legs of byBook.values()) {
    const picked = pickDistinctPlayers(legs, count);
    if (!picked) continue;
    const parlay = makeParlay(picked);
    if (!best || parlay.probability > best.probability) best = parlay;
  }
  return best;
}

export function buildGameParlays(picks: NbaParlayPick[]): NbaGameParlays {
  const pool = picks
    .map(toLeg)
    .filter((leg): leg is NbaParlayLeg => leg !== null)
    .sort((a, b) => a.pick.pRank! - b.pick.pRank!);

  const twoLeg: NbaParlay[] = [];
  const first = bestParlay(pool, 2);
  if (first) {
    twoLeg.push(first);
    // The second 2-leg parlay uses the next-best legs, none repeated
    // from the first, so the two suggestions are genuinely different
    // bets (possibly at a different book).
    const used = new Set(first.legs);
    const second = bestParlay(
      pool.filter((leg) => !used.has(leg)),
      2,
    );
    if (second) twoLeg.push(second);
  }

  const threeLegPool = pool.filter((leg) => leg.pick.pRank != null && leg.pick.pRank <= THREE_LEG_PRANK_CAP);
  return {
    twoLeg,
    threeLeg: bestParlay(threeLegPool, 3),
  };
}
