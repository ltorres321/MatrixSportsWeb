// Shared shape for the per-game detail page -- real data now comes
// from src/lib/predictions.ts (queries latest_predictions). This file
// only keeps the types and the percentile-track scaling helper, which
// has nothing to do with where the data comes from.

export interface GameStatSide {
  alias: string;
  record: string;
  winProb?: number;
  score?: number;
  winner?: boolean;
  // Same meaning as Matchup/TeamSide.trendingUp -- see predictions.ts's
  // fetchPriorHomeWinProbabilities().
  trendingUp?: boolean;
}

export interface GameStat {
  premier?: boolean;
  status: "preview" | "live" | "final";
  kickoff: string;
  marketLine: { spread: string; total: number };
  teamA: GameStatSide;
  teamB: GameStatSide;
  favored: "teamA" | "teamB";
  expectedScore: { teamA: number; teamB: number };
  marginBuckets: { label: string; pct: number }[];
  marginPercentiles: { p05: number; p25: number; p50: number; p75: number; p95: number };
  totals: { line: number; over: number; under: number; isMarketLine?: boolean }[];
  liveNote?: string;
  finalResult?: { winnerAlias: string; margin: number; totalScore: number };
  // Same meaning as Matchup.predictionCorrect -- see there.
  predictionCorrect?: boolean;
  // Same meaning as Matchup.lockOfWeek -- see there.
  lockOfWeek?: boolean;
}

export const PERCENTILE_MIN = -30;
export const PERCENTILE_MAX = 30;

export function scalePosition(value: number): number {
  const clamped = Math.max(PERCENTILE_MIN, Math.min(PERCENTILE_MAX, value));
  return ((clamped - PERCENTILE_MIN) / (PERCENTILE_MAX - PERCENTILE_MIN)) * 100;
}
