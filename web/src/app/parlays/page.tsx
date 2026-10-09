import {
  getAvailableSeasons,
  getWeeksForSeason,
  getDefaultWeek,
  getCurrentSeasonYear,
} from "@/lib/predictions";
import { getLeagueBettingEdge } from "@/lib/pffBettingEdge";
import { buildLeagueParlays, type LeagueParlays } from "@/lib/leagueParlayHelper";
import type { ParlayBookMode } from "@/lib/parlayHelper";
import { recordDisplayedLeagueParlays } from "@/lib/parlayLog";
import ParlaysView from "./ParlaysView";

export const metadata = {
  title: "NFL Parlays — Matrix Sports Analytics",
  description:
    "The week's 5 best-probability NFL parlays, built from our model's highest-confidence player props across every game -- plus how last week's picks actually graded out.",
  alternates: { canonical: "https://matrixsports.net/parlays" },
};

export interface WeekParlays {
  season: number;
  week: number;
  // Both modes are built and logged, same "built server-side so what's
  // shown and what's logged can't differ" contract as the per-game
  // Parlay Helper tab -- single is what the page actually shows (see
  // ParlaysView.tsx's own note on why mixed is hidden for now); mixed is
  // kept alongside it in case that changes.
  parlays: Record<ParlayBookMode, LeagueParlays>;
}

async function buildWeekParlays(season: number, week: number): Promise<WeekParlays> {
  const playerProps = await getLeagueBettingEdge(season, week);
  const parlays: Record<ParlayBookMode, LeagueParlays> = {
    single: buildLeagueParlays(playerProps, "single"),
    mixed: buildLeagueParlays(playerProps, "mixed"),
  };

  // Same "log what's actually shown, never let a logging failure take
  // the page down" contract as the per-game Parlay Helper tab (see
  // pffBettingEdge.ts's getGameBettingEdge).
  try {
    await recordDisplayedLeagueParlays(season, week, parlays);
  } catch (error) {
    console.error("site_league_parlay_log write failed:", error instanceof Error ? error.message : error);
  }

  return { season, week, parlays };
}

// Server Component: no season/week picker here, unlike /home -- this page
// is deliberately just "the two weeks a visitor actually cares about right
// now," the upcoming slate and how the model's last slate actually graded.
export default async function ParlaysPage() {
  const season = await getCurrentSeasonYear();
  const seasons = await getAvailableSeasons();
  const activeSeason = seasons.includes(season) ? season : (seasons[0] ?? season);

  const weeks = await getWeeksForSeason(activeSeason);
  const currentWeek = (await getDefaultWeek(activeSeason)) ?? weeks[weeks.length - 1] ?? null;
  const currentWeekIndex = currentWeek == null ? -1 : weeks.indexOf(currentWeek);
  const previousWeek = currentWeekIndex > 0 ? weeks[currentWeekIndex - 1] : null;

  const [current, previous] = await Promise.all([
    currentWeek != null ? buildWeekParlays(activeSeason, currentWeek) : null,
    previousWeek != null ? buildWeekParlays(activeSeason, previousWeek) : null,
  ]);

  return <ParlaysView season={activeSeason} current={current} previous={previous} />;
}
