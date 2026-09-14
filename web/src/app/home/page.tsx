import {
  getAvailableSeasons,
  getWeeksForSeason,
  getDefaultWeek,
  getPremierGame,
  getMatchupsForSeasonWeek,
  getCurrentSeasonYear,
} from "@/lib/predictions";
import PredictionsView from "./PredictionsView";

export const metadata = {
  title: "NFL Predictions This Week — Matrix Sports Analytics",
  description:
    "Simulated win probabilities for every NFL matchup this week, run 100,000 times per game against the real betting line.",
};

// Server Component: season/week live in the URL (?season=&week=) so
// each combination is a real server-rendered fetch against
// latest_predictions, not client state holding a copy of every
// season's data at once.
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string; week?: string }>;
}) {
  const params = await searchParams;

  const seasons = await getAvailableSeasons();
  if (seasons.length === 0) {
    return <PredictionsView seasons={[]} weeks={[]} activeSeason={null} activeWeek={null} matchups={[]} />;
  }

  const fallbackSeason = await getCurrentSeasonYear();
  const requestedSeason = params.season ? Number(params.season) : NaN;
  const activeSeason = seasons.includes(requestedSeason)
    ? requestedSeason
    : seasons.includes(fallbackSeason)
      ? fallbackSeason
      : seasons[0];

  const weeks = await getWeeksForSeason(activeSeason);
  const defaultWeek = await getDefaultWeek(activeSeason);
  const requestedWeek = params.week ? Number(params.week) : NaN;
  const activeWeek = weeks.includes(requestedWeek)
    ? requestedWeek
    : defaultWeek ?? weeks[weeks.length - 1] ?? null;

  const premier = activeWeek ? await getPremierGame(activeSeason, activeWeek) : null;
  const matchups = activeWeek ? await getMatchupsForSeasonWeek(activeSeason, activeWeek, premier) : [];

  return (
    <PredictionsView
      seasons={seasons}
      weeks={weeks}
      activeSeason={activeSeason}
      activeWeek={activeWeek}
      matchups={matchups}
    />
  );
}
