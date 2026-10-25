// Shared shape for a matchup card -- real data now comes from
// src/lib/predictions.ts (queries latest_predictions). This file only
// keeps the types both that data layer and the UI components import.
//
// formatNbaDateLabel lives here, NOT in nbaPredictions.ts, even though
// it's NBA-specific and that file would otherwise be the natural home
// -- nbaPredictions.ts imports "server-only" (it queries the DB), and
// NbaPredictionsView.tsx is a client component (needs the live-score
// useEffect), so it can't import anything from a server-only module,
// not even a pure formatting function with no DB access. Caught by
// the actual Next.js build failing on exactly that combination. This
// file has no "server-only" import and both sides already share it
// for the Matchup/TeamSide types, so it's the correct neutral home.

export interface TeamSide {
  alias: string;
  record: string;
  prob?: number;
  score?: number;
  winner?: boolean;
  // True only for whichever side's win probability went UP since the
  // previous prediction generated for this game (comparing the two
  // most recent rows in predictions, not just "since yesterday") --
  // never set for the side that went down, a tie, or when there's no
  // prior prediction yet (a brand new game). See predictions.ts's
  // fetchPriorHomeWinProbabilities().
  trendingUp?: boolean;
}

export interface Matchup {
  id: string;
  premier?: boolean;
  // Set only when premier is true -- see PremierGame.label in
  // predictions.ts for what decides this and what it's for.
  premierLabel?: string;
  status: "preview" | "live" | "final";
  kickoff: string;
  teamA: TeamSide;
  teamB: TeamSide;
  // Only set once the game is final AND a model prediction exists for
  // it -- undefined for an upcoming game, a tie, or a schedule-only
  // game the model hasn't run on yet (nothing to grade in any of
  // those cases).
  predictionCorrect?: boolean;
  // True only for the single highest-confidence game of the week AND
  // only when that confidence is >= LOCK_OF_WEEK_THRESHOLD -- see
  // predictions.ts. Implies `premier`, but `premier` doesn't imply
  // this: the free-preview game is always picked, gold styling isn't.
  lockOfWeek?: boolean;
}

export function formatNbaDateLabel(dateKey: string): string {
  // dateKey is a plain YYYY-MM-DD with no time component -- parsed as
  // UTC noon (not midnight) so no timezone conversion can push it to
  // the adjacent calendar day when formatted back out.
  const date = new Date(`${dateKey}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

// monthKey is YYYY-MM (nbaPredictions.ts's getNbaMonthsFromDates) --
// parsed as the 15th at UTC noon, same "land safely mid-period" idea
// as formatNbaDateLabel above, just mid-month instead of mid-day so a
// short/long month can't shift the formatted result.
export function formatNbaMonthLabel(monthKey: string): string {
  const date = new Date(`${monthKey}-15T12:00:00Z`);
  return new Intl.DateTimeFormat("en-US", { month: "short" }).format(date);
}
