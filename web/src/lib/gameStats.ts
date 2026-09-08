// Ported from static/game.js. PLACEHOLDER DATA ONLY -- see that
// file's header comment for what's real vs. not. Keyed by the same
// matchup ids as src/lib/matchups.ts's current-season slate.

export interface GameStatSide {
  alias: string;
  record: string;
  winProb?: number;
  score?: number;
  winner?: boolean;
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
  totals: { line: number; over: number; under: number }[];
  liveNote?: string;
  finalResult?: { winnerAlias: string; margin: number; totalScore: number };
}

export const GAMES: Record<string, GameStat> = {
  "kc-buf": {
    premier: true,
    status: "preview",
    kickoff: "Sun 1:00 PM ET",
    marketLine: { spread: "KC -2.5", total: 46.5 },
    teamA: { alias: "BUF", record: "1-0", winProb: 47 },
    teamB: { alias: "KC", record: "1-0", winProb: 53 },
    favored: "teamB",
    expectedScore: { teamA: 23.1, teamB: 26.4 },
    marginBuckets: [
      { label: "Lost / Tied", pct: 47 },
      { label: "Won by 1-3", pct: 15 },
      { label: "Won by 4-7", pct: 14 },
      { label: "Won by 8-14", pct: 13 },
      { label: "Won by 15-21", pct: 7 },
      { label: "Won by 21+", pct: 4 },
    ],
    marginPercentiles: { p05: -17, p25: -3, p50: 3, p75: 10, p95: 24 },
    totals: [
      { line: 30, over: 92, under: 8 },
      { line: 40, over: 78, under: 22 },
      { line: 44, over: 64, under: 36 },
      { line: 48, over: 47, under: 53 },
      { line: 52, over: 29, under: 71 },
    ],
  },
  "sf-dal": {
    status: "preview",
    kickoff: "Sun 4:25 PM ET",
    marketLine: { spread: "SF -5.5", total: 44.5 },
    teamA: { alias: "DAL", record: "0-1", winProb: 38 },
    teamB: { alias: "SF", record: "1-0", winProb: 62 },
    favored: "teamB",
    expectedScore: { teamA: 19.8, teamB: 26.9 },
    marginBuckets: [
      { label: "Lost / Tied", pct: 38 },
      { label: "Won by 1-3", pct: 12 },
      { label: "Won by 4-7", pct: 16 },
      { label: "Won by 8-14", pct: 18 },
      { label: "Won by 15-21", pct: 10 },
      { label: "Won by 21+", pct: 6 },
    ],
    marginPercentiles: { p05: -12, p25: 1, p50: 8, p75: 15, p95: 27 },
    totals: [
      { line: 30, over: 89, under: 11 },
      { line: 40, over: 71, under: 29 },
      { line: 44, over: 55, under: 45 },
      { line: 48, over: 38, under: 62 },
      { line: 52, over: 21, under: 79 },
    ],
  },
  "phi-bal": {
    status: "live",
    kickoff: "Q3 08:42",
    marketLine: { spread: "PHI -1.5", total: 47.5 },
    teamA: { alias: "BAL", record: "0-1", winProb: 41, score: 17 },
    teamB: { alias: "PHI", record: "1-0", winProb: 59, score: 24 },
    favored: "teamB",
    expectedScore: { teamA: 21.4, teamB: 27.8 },
    marginBuckets: [
      { label: "Lost / Tied", pct: 41 },
      { label: "Won by 1-3", pct: 13 },
      { label: "Won by 4-7", pct: 15 },
      { label: "Won by 8-14", pct: 16 },
      { label: "Won by 15-21", pct: 9 },
      { label: "Won by 21+", pct: 6 },
    ],
    marginPercentiles: { p05: -14, p25: -1, p50: 6, p75: 13, p95: 25 },
    totals: [
      { line: 30, over: 94, under: 6 },
      { line: 40, over: 81, under: 19 },
      { line: 44, over: 69, under: 31 },
      { line: 48, over: 52, under: 48 },
      { line: 52, over: 33, under: 67 },
    ],
    liveNote: "Live probabilities update with the game; pregame figures above are what the model projected before kickoff.",
  },
  "det-gb": {
    status: "final",
    kickoff: "Final",
    marketLine: { spread: "DET -3.5", total: 45.5 },
    teamA: { alias: "GB", record: "0-1", winProb: 39, score: 20 },
    teamB: { alias: "DET", record: "2-0", winProb: 61, score: 27, winner: true },
    favored: "teamB",
    expectedScore: { teamA: 21.0, teamB: 24.6 },
    marginBuckets: [
      { label: "Lost / Tied", pct: 39 },
      { label: "Won by 1-3", pct: 14 },
      { label: "Won by 4-7", pct: 17 },
      { label: "Won by 8-14", pct: 16 },
      { label: "Won by 15-21", pct: 9 },
      { label: "Won by 21+", pct: 5 },
    ],
    marginPercentiles: { p05: -13, p25: 0, p50: 5, p75: 11, p95: 23 },
    totals: [
      { line: 30, over: 90, under: 10 },
      { line: 40, over: 74, under: 26 },
      { line: 44, over: 58, under: 42 },
      { line: 48, over: 41, under: 59 },
      { line: 52, over: 24, under: 76 },
    ],
    finalResult: { winnerAlias: "DET", margin: 7, totalScore: 47 },
  },
  "mia-nyj": {
    status: "preview",
    kickoff: "Sun 1:00 PM ET",
    marketLine: { spread: "MIA -1.5", total: 42.5 },
    teamA: { alias: "NYJ", record: "0-1", winProb: 44 },
    teamB: { alias: "MIA", record: "1-0", winProb: 56 },
    favored: "teamB",
    expectedScore: { teamA: 20.2, teamB: 22.9 },
    marginBuckets: [
      { label: "Lost / Tied", pct: 44 },
      { label: "Won by 1-3", pct: 16 },
      { label: "Won by 4-7", pct: 15 },
      { label: "Won by 8-14", pct: 13 },
      { label: "Won by 15-21", pct: 7 },
      { label: "Won by 21+", pct: 5 },
    ],
    marginPercentiles: { p05: -16, p25: -4, p50: 2, p75: 9, p95: 20 },
    totals: [
      { line: 30, over: 87, under: 13 },
      { line: 40, over: 66, under: 34 },
      { line: 44, over: 49, under: 51 },
      { line: 48, over: 33, under: 67 },
      { line: 52, over: 18, under: 82 },
    ],
  },
  "cin-pit": {
    status: "preview",
    kickoff: "Mon 8:15 PM ET",
    marketLine: { spread: "PIT -0.5", total: 43.5 },
    teamA: { alias: "PIT", record: "1-0", winProb: 51 },
    teamB: { alias: "CIN", record: "0-1", winProb: 49 },
    favored: "teamA",
    expectedScore: { teamA: 22.6, teamB: 22.1 },
    marginBuckets: [
      { label: "Lost / Tied", pct: 49 },
      { label: "Won by 1-3", pct: 17 },
      { label: "Won by 4-7", pct: 14 },
      { label: "Won by 8-14", pct: 11 },
      { label: "Won by 15-21", pct: 6 },
      { label: "Won by 21+", pct: 3 },
    ],
    marginPercentiles: { p05: -19, p25: -6, p50: 0, p75: 6, p95: 17 },
    totals: [
      { line: 30, over: 88, under: 12 },
      { line: 40, over: 68, under: 32 },
      { line: 44, over: 50, under: 50 },
      { line: 48, over: 34, under: 66 },
      { line: 52, over: 19, under: 81 },
    ],
  },
};

export const PERCENTILE_MIN = -30;
export const PERCENTILE_MAX = 30;

export function scalePosition(value: number): number {
  const clamped = Math.max(PERCENTILE_MIN, Math.min(PERCENTILE_MAX, value));
  return ((clamped - PERCENTILE_MIN) / (PERCENTILE_MAX - PERCENTILE_MIN)) * 100;
}
