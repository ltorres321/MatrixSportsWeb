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

// A specific game's own matchup, regardless of which one
// getPremierGame() currently has auto-selected -- for manually posting
// a later broadcast slot's game before the current slot's game has
// technically "ended" (explicit ask 2026-09-20: the 4pm slate can run
// past 7pm, leaving little runway before an 8pm Sunday Night kickoff,
// and the automatic rotation only ever advances once the earlier
// game is confirmed over). Doesn't set premier/premierLabel -- neither
// renderSpotlightCard nor spotlightCaption require them (the caption
// falls back to the generic "Game of the Week" label when absent),
// and this game isn't necessarily what getPremierGame() would call
// premier anyway.
export async function getSpotlightMatchupById(universalGameId: string): Promise<Matchup | null> {
  const season = await getCurrentSeasonYear();
  const week = await getDefaultWeek(season);
  if (week === null) return null;

  const matchups = await getMatchupsForSeasonWeek(season, week);
  return matchups.find((m) => m.id === universalGameId) ?? null;
}
