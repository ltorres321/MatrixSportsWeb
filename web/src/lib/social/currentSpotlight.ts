import { getCurrentSeasonYear, getDefaultWeek, getPremierGame, getMatchupsForSeasonWeek } from "@/lib/predictions";
import type { Matchup } from "@/lib/matchups";

// The premier game for the site's current default week -- same game
// PredictionsView.tsx features at the top of the homepage right now.
export async function getCurrentSpotlightMatchup(): Promise<Matchup | null> {
  const season = await getCurrentSeasonYear();
  const week = await getDefaultWeek(season);
  if (week === null) return null;

  const premier = await getPremierGame(season, week);
  if (!premier) return null;

  const matchups = await getMatchupsForSeasonWeek(season, week, premier);
  return matchups.find((m) => m.id === premier.id) ?? null;
}
