import "server-only";
import { TEAMS } from "@/lib/teams";

// Full NFL schedule from TheSportsDB (thesportsdb.com) -- the user's
// own paid data source, not scraped. This fills the gap the model
// pipeline can't: a game that hasn't been predicted yet (no row in
// predictions) still has a known kickoff time and, once played, a
// real score, and the site should show "games to come" for a season
// even before the model has run on them. See predictions.ts, which
// merges this with the DB's own prediction rows.
//
// Only ever called for the current/future season(s) -- 2024/2025 are
// already fully covered by the backfilled predictions table and
// don't need an external call on every request.

const NFL_LEAGUE_ID = "4391";
// Regular season only -- TheSportsDB uses intRound 500 for preseason
// and 150/160/200 for not-yet-determined future postseason rounds
// (those come back with placeholder team names before the bracket is
// set), neither of which map onto our season/week model.
const REGULAR_SEASON_ROUNDS = new Set(Array.from({ length: 18 }, (_, i) => String(i + 1)));

interface SportsDbEvent {
  strHomeTeam: string;
  strAwayTeam: string;
  intRound: string;
  intHomeScore: string | null;
  intAwayScore: string | null;
  // dateEvent/strTime are UTC (confirmed against strTimestamp) --
  // dateEventLocal/strTimeLocal are unreliable in this feed (spot
  // checks show a stale, repeated local time across an entire day's
  // slate), so UTC is the only field pair actually used below.
  dateEvent: string;
  strTime: string;
  strStatus: string;
}

export interface ScheduleGame {
  universal_game_id: string;
  season: number;
  week: number;
  home_team: string;
  away_team: string;
  game_date: Date;
  actual_home_score: number | null;
  actual_away_score: number | null;
  final: boolean;
}

// TheSportsDB spells out full team names ("Seattle Seahawks"); our
// alias system is the two/three-letter code (SEA). Built once from
// the same TEAMS list the rest of the site uses, so it can never
// drift out of sync with the alias set.
const NAME_TO_ALIAS = new Map(TEAMS.map((t) => [`${t.market} ${t.name}`, t.alias]));

function resolveAlias(fullName: string): string | null {
  return NAME_TO_ALIAS.get(fullName) ?? null;
}

let cache: { season: number; expires: number; games: ScheduleGame[] } | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min -- games aren't finishing more often than that in practice

async function fetchSeasonEvents(season: number): Promise<SportsDbEvent[]> {
  const apiKey = process.env.THESPORTSDB_API_KEY;
  if (!apiKey) return [];

  const url = `https://www.thesportsdb.com/api/v1/json/${apiKey}/eventsseason.php?id=${NFL_LEAGUE_ID}&s=${season}`;
  const res = await fetch(url, { next: { revalidate: 1800 } });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.events ?? []) as SportsDbEvent[];
}

export async function getSeasonSchedule(season: number): Promise<ScheduleGame[]> {
  if (cache && cache.season === season && cache.expires > Date.now()) {
    return cache.games;
  }

  const events = await fetchSeasonEvents(season);
  const games: ScheduleGame[] = [];

  for (const event of events) {
    if (!REGULAR_SEASON_ROUNDS.has(event.intRound)) continue;

    const homeAlias = resolveAlias(event.strHomeTeam);
    const awayAlias = resolveAlias(event.strAwayTeam);
    if (!homeAlias || !awayAlias) continue; // unresolved/placeholder team name -- skip rather than guess

    const week = Number(event.intRound);
    const final = event.strStatus === "FT";

    games.push({
      // Same YYYYTWWAwyHom convention as SportsAnalytics's
      // create_universal_game_id ("R" = regular season) -- this is
      // what lets a schedule-only row and a later model prediction
      // for the same real game line up as the same id.
      universal_game_id: `${season.toString().padStart(4, "0")}R${week.toString().padStart(2, "0")}${awayAlias}${homeAlias}`,
      season,
      week,
      home_team: homeAlias,
      away_team: awayAlias,
      game_date: new Date(`${event.dateEvent}T${event.strTime}Z`),
      actual_home_score: final ? Number(event.intHomeScore) : null,
      actual_away_score: final ? Number(event.intAwayScore) : null,
      final,
    });
  }

  cache = { season, expires: Date.now() + CACHE_TTL_MS, games };
  return games;
}

export async function getScheduleWeek(season: number, week: number): Promise<ScheduleGame[]> {
  const games = await getSeasonSchedule(season);
  return games.filter((g) => g.week === week);
}

export async function getScheduleWeeks(season: number): Promise<number[]> {
  const games = await getSeasonSchedule(season);
  return Array.from(new Set(games.map((g) => g.week))).sort((a, b) => a - b);
}

// Admin diagnostic only -- not used by any real page. fetchSeasonEvents()
// deliberately swallows every failure into a silent [] (a real visitor
// should never see a broken page just because an external API hiccuped),
// which makes "why is the schedule missing" impossible to tell apart
// from "there are genuinely no games" from the outside. This repeats
// the same fetch but reports exactly what happened, to answer that
// question directly instead of guessing through more deploy round-trips.
export interface ScheduleDiagnostics {
  apiKeyPresent: boolean;
  httpStatus: number | null;
  fetchError: string | null;
  eventsReturned: number | null;
  gamesAfterFiltering: number | null;
}

export async function diagnoseScheduleFetch(season: number): Promise<ScheduleDiagnostics> {
  const apiKey = process.env.THESPORTSDB_API_KEY;
  if (!apiKey) {
    return { apiKeyPresent: false, httpStatus: null, fetchError: null, eventsReturned: null, gamesAfterFiltering: null };
  }

  const url = `https://www.thesportsdb.com/api/v1/json/${apiKey}/eventsseason.php?id=${NFL_LEAGUE_ID}&s=${season}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      return { apiKeyPresent: true, httpStatus: res.status, fetchError: null, eventsReturned: null, gamesAfterFiltering: null };
    }
    const data = await res.json();
    const events = (data.events ?? []) as SportsDbEvent[];
    const games = await getSeasonSchedule(season);
    return {
      apiKeyPresent: true,
      httpStatus: res.status,
      fetchError: null,
      eventsReturned: events.length,
      gamesAfterFiltering: games.length,
    };
  } catch (err) {
    return {
      apiKeyPresent: true,
      httpStatus: null,
      fetchError: err instanceof Error ? err.message : String(err),
      eventsReturned: null,
      gamesAfterFiltering: null,
    };
  }
}

export async function getScheduledGame(universalGameId: string): Promise<ScheduleGame | null> {
  const seasonPart = universalGameId.slice(0, 4);
  const season = Number(seasonPart);
  if (!Number.isFinite(season)) return null;
  const games = await getSeasonSchedule(season);
  return games.find((g) => g.universal_game_id === universalGameId) ?? null;
}
