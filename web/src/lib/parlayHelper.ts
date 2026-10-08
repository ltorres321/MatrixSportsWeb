import type { PlayerPropEntry } from "@/lib/pffBettingEdge";

// Parlay Helper -- builds same-game parlays out of the game's own top
// player props, ranked by the model's per-game pRank (see
// PlayerPropEntry.pRank). Pure functions, no I/O: everything here runs
// off the playerProps array the Betting Edge query already returns.

// "From the top 10 using the pRank" -- only props the model ranks 1-10
// within this game are eligible to be a leg.
export const PARLAY_POOL_SIZE = 10;

// A 3-leg parlay is only offered when EVERY leg is rated at least this
// likely to hit; if fewer than three distinct players have a prop that
// clears the bar, no 3-leg parlay is shown for the game. The parlay's own
// combined probability has no minimum -- it's just displayed.
export const MIN_THREE_LEG_LEG_PROBABILITY = 0.55;

export interface ParlayLeg {
  entry: PlayerPropEntry;
  // The model's estimated chance this single prop pick hits.
  probability: number;
  // What $1 returns (stake included) if this leg alone wins, from the
  // leg's own American odds.
  decimalOdds: number;
  // The book/price this leg is actually priced at -- PFF's own pick, or
  // a book from etl.player_prop_lines_current quoting the SAME line/side
  // at a better price, whichever pays more (see toLeg below). Distinct
  // from entry.pickSportsbook/pickOdds, which stay PFF's own pick for the
  // Betting Edge table's display -- never mutate entry itself, since other
  // parts of the page read it too.
  sportsbook: string | null;
  odds: number;
  oddsSource: "pff" | "player_prop_lines";
  oddsAsOf: string | null;
}

// "single": every leg of a parlay is priced at the same sportsbook, so it
// can be placed as one slip (the default). "mixed": best combination
// regardless of book -- the legs can't be combined into one parlay at any
// single book, they'd have to be bet separately.
export type ParlayBookMode = "single" | "mixed";

export interface Parlay {
  legs: ParlayLeg[];
  // The one sportsbook every leg is priced at, or null when the legs are
  // at different books (mixed mode).
  sportsbook: string | null;
  // Product of the legs' probabilities -- assumes the legs are
  // independent, which same-game legs are not strictly (e.g. an RB's
  // rushing yards and attempts move together). Treat as an estimate.
  probability: number;
  // Product of the legs' decimal odds: the total returned on a $1 bet,
  // stake included (so profit is decimalOdds - 1).
  decimalOdds: number;
}

export interface GameParlays {
  twoLeg: Parlay[];
  // Null when fewer than three distinct players have a leg at or above
  // MIN_THREE_LEG_LEG_PROBABILITY.
  threeLeg: Parlay | null;
}

export function americanToDecimal(odds: number): number {
  return odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds);
}

// Line-shopping: PFF's own pick vs. the best-priced book currently quoting
// the IDENTICAL line/side (pffBettingEdge.ts's matchingLine* fields -- never
// a different line, since the model's probability wouldn't transfer to one;
// see reference_prop_line_apis memory). American odds compare correctly with
// a plain `>` across the +/- boundary (decimal odds are monotonic in the
// raw American number), so whichever number is larger pays more.
function pickBestPrice(entry: PlayerPropEntry): Pick<ParlayLeg, "sportsbook" | "odds" | "oddsSource" | "oddsAsOf"> | null {
  const pff = entry.pickOdds != null
    ? { sportsbook: entry.pickSportsbook, odds: entry.pickOdds, oddsSource: "pff" as const, oddsAsOf: entry.oddsAsOf }
    : null;
  const market = entry.matchingLineOdds != null
    ? { sportsbook: entry.matchingLineSportsbook, odds: entry.matchingLineOdds, oddsSource: "player_prop_lines" as const, oddsAsOf: entry.matchingLineAsOf }
    : null;
  if (!pff) return market;
  if (!market) return pff;
  return market.odds > pff.odds ? market : pff;
}

function toLeg(entry: PlayerPropEntry): ParlayLeg | null {
  if (entry.pRank == null || entry.pRank > PARLAY_POOL_SIZE) return null;
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

function makeParlay(legs: ParlayLeg[]): Parlay {
  const books = new Set(legs.map((l) => l.sportsbook));
  return {
    legs,
    sportsbook: books.size === 1 ? [...books][0] : null,
    probability: legs.reduce((p, l) => p * l.probability, 1),
    decimalOdds: legs.reduce((d, l) => d * l.decimalOdds, 1),
  };
}

// Walks the candidates best-first and takes the first `count` legs that
// belong to distinct players: two legs on the same player (his rushing
// yards and his rushing attempts, say) are close to the same bet twice
// and would overstate the parlay's probability.
function pickDistinctPlayers(candidates: ParlayLeg[], count: number): ParlayLeg[] | null {
  const picked: ParlayLeg[] = [];
  const players = new Set<string>();
  for (const leg of candidates) {
    if (players.has(leg.entry.playerName)) continue;
    players.add(leg.entry.playerName);
    picked.push(leg);
    if (picked.length === count) return picked;
  }
  return null;
}

// Best `count`-leg parlay from `pool` (already sorted best-first) whose
// legs all clear `minLegProbability`. In single-book mode it builds the best
// parlay available at each sportsbook and keeps the most likely one; legs
// with no known sportsbook can't be placed anywhere, so they're skipped.
function bestParlay(
  pool: ParlayLeg[],
  count: number,
  mode: ParlayBookMode,
  minLegProbability = 0,
): Parlay | null {
  const eligible = pool.filter((leg) => leg.probability >= minLegProbability);

  if (mode === "mixed") {
    const legs = pickDistinctPlayers(eligible, count);
    return legs ? makeParlay(legs) : null;
  }

  const byBook = new Map<string, ParlayLeg[]>();
  for (const leg of eligible) {
    const book = leg.sportsbook;
    if (!book) continue;
    byBook.set(book, [...(byBook.get(book) ?? []), leg]);
  }

  let best: Parlay | null = null;
  for (const legs of byBook.values()) {
    const picked = pickDistinctPlayers(legs, count);
    if (!picked) continue;
    const parlay = makeParlay(picked);
    if (!best || parlay.probability > best.probability) best = parlay;
  }
  return best;
}

export function buildGameParlays(
  playerProps: PlayerPropEntry[],
  mode: ParlayBookMode = "single",
): GameParlays {
  const pool = playerProps
    .map(toLeg)
    .filter((leg): leg is ParlayLeg => leg !== null)
    .sort((a, b) => a.entry.pRank! - b.entry.pRank!);

  const twoLeg: Parlay[] = [];

  const first = bestParlay(pool, 2, mode);
  if (first) {
    twoLeg.push(first);
    // The second 2-leg parlay uses the next-best legs, none repeated
    // from the first, so the two suggestions are genuinely different bets
    // (in single-book mode it may land at a different book).
    const used = new Set(first.legs);
    const second = bestParlay(
      pool.filter((leg) => !used.has(leg)),
      2,
      mode,
    );
    if (second) twoLeg.push(second);
  }

  return {
    twoLeg,
    threeLeg: bestParlay(pool, 3, mode, MIN_THREE_LEG_LEG_PROBABILITY),
  };
}
