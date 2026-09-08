// Ported from static/home.js. Placeholder data only -- not fetched
// from the FastAPI predictions API and not model output. See
// main.py's module header for what's actually live in this project.

export interface TeamSide {
  alias: string;
  record: string;
  prob?: number;
  score?: number;
  winner?: boolean;
}

export interface Matchup {
  id: string;
  premier?: boolean;
  status: "preview" | "live" | "final";
  kickoff: string;
  teamA: TeamSide;
  teamB: TeamSide;
}

export const CURRENT_WEEK = 2;
export const WEEKS = Array.from({ length: 18 }, (_, i) => i + 1);

// NFL seasons span two calendar years (kicks off in Sept, ends the
// following Feb) -- so "the current season" is this year until
// ~March, then last year until the new season kicks off.
export function getCurrentSeasonYear(): number {
  const now = new Date();
  return now.getMonth() < 2 ? now.getFullYear() - 1 : now.getFullYear();
}

const CURRENT_SEASON_MATCHUPS: Matchup[] = [
  {
    id: "kc-buf",
    premier: true,
    status: "preview",
    kickoff: "Sun 1:00 PM ET",
    teamA: { alias: "BUF", record: "1-0", prob: 47 },
    teamB: { alias: "KC", record: "1-0", prob: 53 },
  },
  {
    id: "sf-dal",
    status: "preview",
    kickoff: "Sun 4:25 PM ET",
    teamA: { alias: "DAL", record: "0-1", prob: 38 },
    teamB: { alias: "SF", record: "1-0", prob: 62 },
  },
  {
    id: "phi-bal",
    status: "live",
    kickoff: "Q3 08:42",
    teamA: { alias: "BAL", record: "0-1", prob: 41, score: 17 },
    teamB: { alias: "PHI", record: "1-0", prob: 59, score: 24 },
  },
  {
    id: "det-gb",
    status: "final",
    kickoff: "Final",
    teamA: { alias: "GB", record: "0-1", score: 20 },
    teamB: { alias: "DET", record: "2-0", score: 27, winner: true },
  },
  {
    id: "mia-nyj",
    status: "preview",
    kickoff: "Sun 1:00 PM ET",
    teamA: { alias: "NYJ", record: "0-1", prob: 44 },
    teamB: { alias: "MIA", record: "1-0", prob: 56 },
  },
  {
    id: "cin-pit",
    status: "preview",
    kickoff: "Mon 8:15 PM ET",
    teamA: { alias: "PIT", record: "1-0", prob: 51 },
    teamB: { alias: "CIN", record: "0-1", prob: 49 },
  },
];

const PRIOR_SEASON_1_MATCHUPS: Matchup[] = [
  {
    id: "py1-kc-buf",
    premier: true,
    status: "final",
    kickoff: "Final",
    teamA: { alias: "BUF", record: "11-6", score: 24 },
    teamB: { alias: "KC", record: "14-3", score: 27, winner: true },
  },
  {
    id: "py1-sf-dal",
    status: "final",
    kickoff: "Final",
    teamA: { alias: "DAL", record: "7-10", score: 20 },
    teamB: { alias: "SF", record: "12-5", score: 30, winner: true },
  },
  {
    id: "py1-phi-bal",
    status: "final",
    kickoff: "Final",
    teamA: { alias: "BAL", record: "12-5", score: 27, winner: true },
    teamB: { alias: "PHI", record: "11-6", score: 21 },
  },
  {
    id: "py1-det-gb",
    status: "final",
    kickoff: "Final",
    teamA: { alias: "GB", record: "11-6", score: 27, winner: true },
    teamB: { alias: "DET", record: "12-5", score: 24 },
  },
  {
    id: "py1-mia-nyj",
    status: "final",
    kickoff: "Final",
    teamA: { alias: "NYJ", record: "5-12", score: 17 },
    teamB: { alias: "MIA", record: "8-9", score: 20, winner: true },
  },
  {
    id: "py1-cin-pit",
    status: "final",
    kickoff: "Final",
    teamA: { alias: "PIT", record: "10-7", score: 20 },
    teamB: { alias: "CIN", record: "9-8", score: 23, winner: true },
  },
];

const PRIOR_SEASON_2_MATCHUPS: Matchup[] = [
  {
    id: "py2-kc-buf",
    premier: true,
    status: "final",
    kickoff: "Final",
    teamA: { alias: "BUF", record: "10-7", score: 17 },
    teamB: { alias: "KC", record: "15-2", score: 31, winner: true },
  },
  {
    id: "py2-sf-dal",
    status: "final",
    kickoff: "Final",
    teamA: { alias: "DAL", record: "9-8", score: 27, winner: true },
    teamB: { alias: "SF", record: "10-7", score: 20 },
  },
  {
    id: "py2-phi-bal",
    status: "final",
    kickoff: "Final",
    teamA: { alias: "BAL", record: "10-7", score: 21 },
    teamB: { alias: "PHI", record: "11-6", score: 24, winner: true },
  },
  {
    id: "py2-det-gb",
    status: "final",
    kickoff: "Final",
    teamA: { alias: "GB", record: "9-8", score: 20 },
    teamB: { alias: "DET", record: "13-4", score: 23, winner: true },
  },
  {
    id: "py2-mia-nyj",
    status: "final",
    kickoff: "Final",
    teamA: { alias: "NYJ", record: "6-11", score: 24, winner: true },
    teamB: { alias: "MIA", record: "9-8", score: 23 },
  },
  {
    id: "py2-cin-pit",
    status: "final",
    kickoff: "Final",
    teamA: { alias: "PIT", record: "11-6", score: 27, winner: true },
    teamB: { alias: "CIN", record: "8-9", score: 24 },
  },
];

export function getSeasons(): Record<number, { current: boolean; matchups: Matchup[] }> {
  const year = getCurrentSeasonYear();
  return {
    [year]: { current: true, matchups: CURRENT_SEASON_MATCHUPS },
    [year - 1]: { current: false, matchups: PRIOR_SEASON_1_MATCHUPS },
    [year - 2]: { current: false, matchups: PRIOR_SEASON_2_MATCHUPS },
  };
}
