// Shared shape for a matchup card -- real data now comes from
// src/lib/predictions.ts (queries latest_predictions). This file only
// keeps the types both that data layer and the UI components import.

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
