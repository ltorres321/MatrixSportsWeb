// Pure stat-picking functions over an already-fetched week of
// Matchup[] -- no DB access here, so these are cheap to call from
// both the admin preview routes (this week's data, fetched via
// lib/predictions.ts) and later the actual posting scheduled function
// (same shape, fetched via the Netlify Functions' own query() layer).
import type { Matchup } from "@/lib/matchups";

export interface WeekRecord {
  correct: number;
  total: number;
}

// Only counts games with a graded prediction -- see
// Matchup.predictionCorrect's own docstring for when that's unset
// (upcoming, a tie, or no model prediction for that game).
export function getWeekRecord(matchups: Matchup[]): WeekRecord {
  const graded = matchups.filter((m) => m.predictionCorrect !== undefined);
  return {
    correct: graded.filter((m) => m.predictionCorrect === true).length,
    total: graded.length,
  };
}

// Smallest final margin among graded final games -- null if none are
// final yet, or none have both scores set (shouldn't happen for a
// truly final game, but scores are optional on TeamSide).
export function getClosestGame(matchups: Matchup[]): Matchup | null {
  let closest: Matchup | null = null;
  let closestMargin = Infinity;

  for (const m of matchups) {
    if (m.status !== "final") continue;
    const a = m.teamA.score;
    const b = m.teamB.score;
    if (a === undefined || b === undefined) continue;
    const margin = Math.abs(a - b);
    if (margin < closestMargin) {
      closestMargin = margin;
      closest = m;
    }
  }

  return closest;
}

// Highest pre-game win probability among correctly-called final
// games -- i.e. the model's most confident call that actually landed.
// Uses the winning side's own `prob` field, which stays populated
// after the game goes final (see TeamRow in MatchupCard.tsx).
export function getBestPick(matchups: Matchup[]): { matchup: Matchup; winProb: number } | null {
  let best: { matchup: Matchup; winProb: number } | null = null;

  for (const m of matchups) {
    if (m.status !== "final" || m.predictionCorrect !== true) continue;
    const winner = m.teamA.winner ? m.teamA : m.teamB.winner ? m.teamB : null;
    if (!winner || winner.prob === undefined) continue;
    if (!best || winner.prob > best.winProb) {
      best = { matchup: m, winProb: winner.prob };
    }
  }

  return best;
}

export type WeeklyInsight =
  | { kind: "bestPick"; matchup: Matchup; winProb: number }
  | { kind: "closestGame"; matchup: Matchup; margin: number };

// Auto-picks whichever of the two insight types is more compelling
// for a given week, rather than always posting the same kind: a very
// confident correct call (>=80%) beats a merely-close game, since
// "the model called an 80%+ favorite and nailed it" is a stronger
// credibility pitch than an average nail-biter. Falls back to
// whichever one exists if only one type is available for the week.
export function pickWeeklyInsight(matchups: Matchup[]): WeeklyInsight | null {
  const bestPick = getBestPick(matchups);
  const closest = getClosestGame(matchups);

  if (bestPick && bestPick.winProb >= 80) {
    return { kind: "bestPick", matchup: bestPick.matchup, winProb: bestPick.winProb };
  }
  if (closest) {
    const margin = Math.abs((closest.teamA.score ?? 0) - (closest.teamB.score ?? 0));
    return { kind: "closestGame", matchup: closest, margin };
  }
  if (bestPick) {
    return { kind: "bestPick", matchup: bestPick.matchup, winProb: bestPick.winProb };
  }
  return null;
}
