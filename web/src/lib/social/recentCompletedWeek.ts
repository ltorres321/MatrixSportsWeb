import { getCurrentSeasonYear, getWeeksForSeason, getMatchupsForSeasonWeek } from "@/lib/predictions";
import type { Matchup } from "@/lib/matchups";

export interface CompletedWeek {
  season: number;
  week: number;
  matchups: Matchup[];
}

// Walks backwards from the season's latest known week looking for the
// most recent one with at least one final game -- good enough for
// this admin preview tool. The real scheduled poster (once built)
// should use the stricter mostRecentFinalWeek() in
// netlify/functions/_shared/storiesCore.ts instead, which accounts
// for the SportsAnalytics sync job's score-backfill lag (see that
// function's own comment).
export async function getMostRecentCompletedWeek(): Promise<CompletedWeek | null> {
  const season = await getCurrentSeasonYear();
  const weeks = await getWeeksForSeason(season);
  if (weeks.length === 0) return null;

  const sorted = [...weeks].sort((a, b) => b - a);
  for (const week of sorted) {
    const matchups = await getMatchupsForSeasonWeek(season, week);
    if (matchups.some((m) => m.status === "final")) {
      return { season, week, matchups };
    }
  }
  return null;
}
