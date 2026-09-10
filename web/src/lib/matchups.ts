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
}
