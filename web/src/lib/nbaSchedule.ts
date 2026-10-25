import "server-only";
import { NBA_TEAMS } from "@/lib/teamsNba";

// NBA equivalent of schedule.ts (TheSportsDB), filling the exact gap
// the user flagged: latest_nba_predictions has no actual-score sync
// step yet (see nbaPredictions.ts's own header and
// sql/008_nba_predictions_schema.sql's actual_home_score/
// actual_away_score columns, which src4 never populates today), so a
// completed NBA game was showing no final score at all.
//
// Can't reuse schedule.ts's getScheduledGame() approach of
// reconstructing the DB's own id and looking it up directly:
// src4/26_predict_upcoming_games.py sets universal_game_id to
// str(row["game_id"]) -- hoopR's raw internal game id, which has no
// derivable relationship to anything TheSportsDB returns. Matching
// here is instead by (home alias, away alias, ET calendar date) --
// the same join key common_nba.py's resolve_nba_game_id() already
// uses on the Python side for the identical problem (matching a live
// odds/injury feed to a predicted game with no shared id).
//
// season here is hoopR's own convention (confirmed against
// data/raw/hoopr/schedules/parquet/nba_schedule_2026.parquet: games
// from 2025-10-21 to 2026-06-13 are season 2026) -- the ENDING year of
// a season that spans two calendar years. TheSportsDB's `s=` param
// wants "2025-2026", so that string is built from season-1 to season.

const NBA_LEAGUE_ID = "4387";

// Confirmed live against the 2025-2026 feed: "500" is preseason (65
// events, early-October dates with real teams but no corresponding
// hoopR/nba_predictions row to match against), 0/1-26 are regular
// season, 160/200/400 are playoff rounds. Excluding 500 defensively,
// same reasoning as schedule.ts's REGULAR_SEASON_ROUNDS -- matching
// below is by team+date anyway, so this isn't load-bearing, just
// avoids ever matching an exhibition game by accident.
const EXCLUDED_ROUNDS = new Set(["500"]);

interface SportsDbEvent {
  strHomeTeam: string;
  strAwayTeam: string;
  intRound: string;
  intHomeScore: string | null;
  intAwayScore: string | null;
  dateEvent: string;
  strTime: string;
  strStatus: string;
}

// TheSportsDB's eventsseason.php (SportsDbEvent above) only ever
// returns "FT"/"AOT" -- confirmed live, 1,380 events checked, zero
// other status values -- so it's a RESULTS feed, not a live one, and
// it lags: a game already final on the live feed below was still
// absent from this one entirely. livescore.php is the actual live
// feed -- confirmed live statuses "NS" (not started), "Q1"-"Q4", "HT"
// (halftime), "FT"/"AOT" (final), with real scores attached to every
// non-"NS" status, not just final ones. It's shared across ALL sports
// (strSport "Basketball" covers college ball etc. too), so every read
// filters idLeague === NBA_LEAGUE_ID.
interface SportsDbLiveEvent {
  idLeague: string;
  strHomeTeam: string;
  strAwayTeam: string;
  intHomeScore: string | null;
  intAwayScore: string | null;
  dateEvent: string;
  strEventTime: string;
  strStatus: string;
}

const LIVE_PERIOD_LABELS: Record<string, string> = {
  Q1: "1st Quarter", Q2: "2nd Quarter", Q3: "3rd Quarter", Q4: "4th Quarter",
  HT: "Halftime", OT: "Overtime",
};

export interface NbaScheduleGame {
  homeTeam: string; // alias, e.g. "CHA"
  awayTeam: string;
  gameDate: Date;
  actualHomeScore: number | null;
  actualAwayScore: number | null;
  final: boolean;
  // Real-time, not yet final -- actualHomeScore/actualAwayScore are
  // the CURRENT score while this is true. period is a display label
  // ("3rd Quarter", "Halftime") or null when not live.
  live: boolean;
  period: string | null;
}

const NAME_TO_ALIAS = new Map(NBA_TEAMS.map((t) => [`${t.market} ${t.name}`, t.alias]));
// TheSportsDB sends "Los Angeles Clippers" (confirmed live), not the
// "LA Clippers" teamsNba.ts otherwise uses everywhere else -- same
// mismatch already found and fixed on the Python/PropLine side
// (SportsPipelines/prop_lines/common_nba.py) for the identical reason.
// Every Clippers game was silently failing to resolve here, which is
// why it stayed "UPCOMING" forever: resolveAlias returned null, so
// the team-match check in getNbaScheduledGame could never succeed.
NAME_TO_ALIAS.set("Los Angeles Clippers", "LAC");

function resolveAlias(fullName: string): string | null {
  return NAME_TO_ALIAS.get(fullName) ?? null;
}

// TheSportsDB's dateEvent/strTime are a real UTC instant -- late-evening
// ET games commonly roll past UTC midnight (confirmed live: a Heat vs
// Pistons tip-off showed dateEvent "2026-10-24" strTime "01:30:00",
// which is 9:30pm ET on the 23rd), so this needs an actual timezone
// conversion to land on the correct ET calendar day.
export function etDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(date);
}


function theSportsDbSeasonString(season: number): string {
  return `${season - 1}-${season}`;
}

let cache: { season: number; expires: number; games: NbaScheduleGame[] } | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000;

async function fetchSeasonEvents(season: number): Promise<SportsDbEvent[]> {
  const apiKey = process.env.THESPORTSDB_API_KEY;
  if (!apiKey) return [];

  const url = `https://www.thesportsdb.com/api/v1/json/${apiKey}/eventsseason.php?id=${NBA_LEAGUE_ID}&s=${theSportsDbSeasonString(season)}`;
  const res = await fetch(url, { next: { revalidate: 1800 } });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.events ?? []) as SportsDbEvent[];
}

// Much shorter TTL than the season cache above -- a live score is
// stale within minutes, not 30. TheSportsDB's `updated` field on live
// rows (checked live) moves roughly every couple minutes on its own,
// so 60s keeps this page close to that without a fetch on every request.
let liveCache: { expires: number; events: SportsDbLiveEvent[] } | null = null;
const LIVE_CACHE_TTL_MS = 60 * 1000;

async function fetchLiveEvents(): Promise<SportsDbLiveEvent[]> {
  if (liveCache && liveCache.expires > Date.now()) return liveCache.events;

  const apiKey = process.env.THESPORTSDB_API_KEY;
  if (!apiKey) return [];

  const url = `https://www.thesportsdb.com/api/v1/json/${apiKey}/livescore.php?s=Basketball`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  const events = ((data.livescore ?? []) as SportsDbLiveEvent[]).filter(
    (e) => e.idLeague === NBA_LEAGUE_ID
  );
  liveCache = { expires: Date.now() + LIVE_CACHE_TTL_MS, events };
  return events;
}

export async function getNbaSeasonSchedule(season: number): Promise<NbaScheduleGame[]> {
  if (cache && cache.season === season && cache.expires > Date.now()) {
    return cache.games;
  }

  const events = await fetchSeasonEvents(season);
  const games: NbaScheduleGame[] = [];

  for (const event of events) {
    if (EXCLUDED_ROUNDS.has(event.intRound)) continue;

    const homeAlias = resolveAlias(event.strHomeTeam);
    const awayAlias = resolveAlias(event.strAwayTeam);
    if (!homeAlias || !awayAlias) continue;

    // Same two statuses NFL's schedule.ts observed -- "AOT" (After
    // Over Time) needs its own check or an overtime game never shows
    // as final. The 0-0 exclusion guards a real bad-data case hit
    // live while building this: a game barely in the future came back
    // status "FT" with intHomeScore/intAwayScore both "0" -- an NBA
    // game can never legitimately end 0-0, so this is TheSportsDB's
    // own stale placeholder, not a real result, and showing it would
    // be worse than showing nothing.
    const bothScoresZero = event.intHomeScore === "0" && event.intAwayScore === "0";
    const final = (event.strStatus === "FT" || event.strStatus === "AOT") && !bothScoresZero;

    games.push({
      homeTeam: homeAlias,
      awayTeam: awayAlias,
      gameDate: new Date(`${event.dateEvent}T${event.strTime}Z`),
      actualHomeScore: final ? Number(event.intHomeScore) : null,
      actualAwayScore: final ? Number(event.intAwayScore) : null,
      final,
      live: false,
      period: null,
    });
  }

  cache = { season, expires: Date.now() + CACHE_TTL_MS, games };
  return games;
}

// NBA equivalent of predictions.ts's getTeamRecords() -- that one
// tallies from latest_predictions.actual_home_score/actual_away_score
// because football's DB sync actually populates those columns. NBA's
// nba_predictions never does (see nbaPredictions.ts's own header), so
// there's nothing to tally in the DB at all -- this instead tallies
// straight from TheSportsDB's season schedule (the same source
// getNbaScheduledGame already uses for every other real score on this
// site), the only place a real NBA result exists for this project.
//
// "Record at time of matchup," same idea as football's `week <
// throughWeek` cutoff -- but NBA has no week number shared across a
// whole slate (different teams can have played a different count of
// games by the same calendar date), so this takes an explicit
// beforeDateKey (an ET YYYY-MM-DD) and counts only games whose OWN ET
// date is strictly earlier, not just "already completed" -- a team's
// TODAY'S game must never count toward the record shown for that same
// game's own card.
export async function getNbaTeamRecords(
  season: number,
  beforeDateKey: string
): Promise<Map<string, string>> {
  const games = await getNbaSeasonSchedule(season);
  const tally = new Map<string, { w: number; l: number }>();
  const bump = (team: string, key: "w" | "l") => {
    const cur = tally.get(team) ?? { w: 0, l: 0 };
    cur[key]++;
    tally.set(team, cur);
  };

  for (const g of games) {
    if (!g.final || g.actualHomeScore === null || g.actualAwayScore === null) continue;
    if (etDateKey(g.gameDate) >= beforeDateKey) continue;
    // No tie branch -- confirmed in src4/FINDINGS.md: NBA games can't
    // end level, so every final game is a clean win for one side.
    if (g.actualHomeScore > g.actualAwayScore) {
      bump(g.homeTeam, "w");
      bump(g.awayTeam, "l");
    } else {
      bump(g.homeTeam, "l");
      bump(g.awayTeam, "w");
    }
  }

  const map = new Map<string, string>();
  for (const [team, rec] of tally) map.set(team, `${rec.w}-${rec.l}`);
  return map;
}

// Checked live which of TheSportsDB's two feeds matches a given game
// first by team alias + ET date. The live feed (fetchLiveEvents) is
// checked FIRST -- it's the one with real in-progress scores, and
// it's also more current for games that just went final (a game
// already "FT" there was still missing entirely from the season bulk
// feed, same slate, same moment -- see that function's own header).
// The season bulk feed is the fallback for anything the live feed has
// already aged out (TheSportsDB's livescore.php only carries a
// rolling window of recent/current games, not the full season).
export async function getNbaScheduledGame(
  homeTeam: string,
  awayTeam: string,
  gameDate: Date
): Promise<NbaScheduleGame | null> {
  // gameDate is nba_predictions.game_date -- a real tipoff instant
  // since src4/25's fix (it used to be a date-only value stamped at
  // midnight UTC, which made a literal UTC-string-slice safe; a real
  // instant needs the same ET conversion as any other live timestamp,
  // or a late-evening ET game rolls into the next UTC day here).
  const targetKey = etDateKey(gameDate);

  const liveEvents = await fetchLiveEvents();
  const liveMatch = liveEvents.find((e) => {
    const homeAlias = resolveAlias(e.strHomeTeam);
    const awayAlias = resolveAlias(e.strAwayTeam);
    if (homeAlias !== homeTeam || awayAlias !== awayTeam) return false;
    return etDateKey(new Date(`${e.dateEvent}T${e.strEventTime}Z`)) === targetKey;
  });

  if (liveMatch && liveMatch.strStatus !== "NS") {
    const bothScoresZero = liveMatch.intHomeScore === "0" && liveMatch.intAwayScore === "0";
    const final = (liveMatch.strStatus === "FT" || liveMatch.strStatus === "AOT") && !bothScoresZero;
    const live = !final && liveMatch.strStatus !== "NS";
    return {
      homeTeam,
      awayTeam,
      gameDate: new Date(`${liveMatch.dateEvent}T${liveMatch.strEventTime}Z`),
      actualHomeScore: liveMatch.intHomeScore !== null ? Number(liveMatch.intHomeScore) : null,
      actualAwayScore: liveMatch.intAwayScore !== null ? Number(liveMatch.intAwayScore) : null,
      final,
      live,
      period: live ? (LIVE_PERIOD_LABELS[liveMatch.strStatus] ?? liveMatch.strStatus) : null,
    };
  }

  // hoopR's season is the ENDING calendar year -- a game in
  // Oct-Dec belongs to next year's season number (nba_schedule_2026
  // covers Oct 2025 - Jun 2026), so derive it from the month, not
  // the plain calendar year.
  const year = gameDate.getUTCFullYear();
  const month = gameDate.getUTCMonth(); // 0-indexed
  const season = month >= 6 ? year + 1 : year; // Jul(6)-Dec -> next year's season

  const games = await getNbaSeasonSchedule(season);
  return (
    games.find(
      (g) =>
        g.homeTeam === homeTeam &&
        g.awayTeam === awayTeam &&
        etDateKey(g.gameDate) === targetKey
    ) ?? null
  );
}
