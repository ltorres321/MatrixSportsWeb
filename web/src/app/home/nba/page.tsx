import {
  getAvailableNbaSeasons,
  getAvailableNbaDates,
  getNbaMonthsFromDates,
  pickDefaultDateInMonth,
  getDefaultNbaDate,
  getMatchupsForNbaDate,
} from "@/lib/nbaPredictions";
import NbaPredictionsView from "./NbaPredictionsView";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "NBA Predictions — Matrix Sports Analytics",
  description: "AI-simulated win probabilities for every NBA matchup.",
  path: "/home/nba",
});

// NBA equivalent of home/page.tsx, keyed by date (?date=) instead of
// season+week -- see nbaPredictions.ts's module header for why NBA
// has no "week" to key off. ?season= now mirrors home/page.tsx too --
// src4/38_backfill_historical_seasons.py gave latest_nba_predictions
// real rows for 2025-26/2024-25 alongside the current season, but
// this page only ever read seasons[0] (always the newest), so there
// was nothing to switch TO those with even once the data existed.
//
// ?month= now narrows the day-rail to one calendar month -- a full
// NBA season is ~180 playing days, too many to scan in one horizontal
// rail (the user's own complaint). months/dates both come from ONE
// getAvailableNbaDates(season) call -- see that function's own
// "stored and easily retrievable" comment; the month filter is a pure
// in-memory grouping of what's already fetched, not a second query.
//
// REAL BUG FIXED HERE, NOT JUST THE MONTH FEATURE: the day-rail's
// links never carried `season=` at all (confirmed live: picking
// 2026-03-14 while on the 2025-26 season silently fell back to the
// CURRENT season, whose dates list obviously has no March 2026, so it
// fell through to today's default) -- every date/month link built
// below now always carries season forward, and the date/month
// resolution happens together so a date always wins over a stale
// month if both are present but disagree.
export default async function NbaHomePage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string; month?: string; date?: string }>;
}) {
  const params = await searchParams;

  const seasons = await getAvailableNbaSeasons();
  if (seasons.length === 0) {
    return (
      <NbaPredictionsView
        seasons={[]} season={null} months={[]} activeMonth={null}
        dates={[]} activeDate={null} matchups={[]}
      />
    );
  }
  const requestedSeason = params.season ? Number(params.season) : NaN;
  const season = seasons.includes(requestedSeason) ? requestedSeason : seasons[0];

  const allDates = await getAvailableNbaDates(season);
  const months = getNbaMonthsFromDates(allDates);

  let activeDate: string | null;
  let activeMonth: string | null;

  if (params.date && allDates.includes(params.date)) {
    // An explicit, valid date always wins -- its own month overrides
    // whatever ?month= said, so the two params can never disagree.
    activeDate = params.date;
    activeMonth = activeDate.slice(0, 7);
  } else if (params.month && months.includes(params.month)) {
    activeMonth = params.month;
    activeDate = pickDefaultDateInMonth(allDates, activeMonth);
  } else {
    activeDate = await getDefaultNbaDate(season);
    activeMonth = activeDate ? activeDate.slice(0, 7) : months[months.length - 1] ?? null;
  }

  const dates = activeMonth ? allDates.filter((d) => d.startsWith(activeMonth!)) : [];
  const matchups = activeDate ? await getMatchupsForNbaDate(season, activeDate) : [];

  return (
    <NbaPredictionsView
      seasons={seasons}
      season={season}
      months={months}
      activeMonth={activeMonth}
      dates={dates}
      activeDate={activeDate}
      matchups={matchups}
    />
  );
}
