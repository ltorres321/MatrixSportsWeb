import "server-only";
import { query } from "@/lib/db";
import type { Matchup, TeamSide } from "@/lib/matchups";
import { getNbaScheduledGame, getNbaTeamRecords } from "@/lib/nbaSchedule";

// NBA equivalent of predictions.ts, reading src4/26_predict_upcoming_games.py's
// output (latest_nba_predictions -- see SportsAnalytics sql/008_nba_predictions_schema.sql).
// Deliberately a small subset of predictions.ts's feature set, not a port
// of it: there is no NBA live in-progress score feed, no premier-game/
// trending-arrow logic built yet -- see src4/FINDINGS.md. `record` DOES
// now come from a real source (getNbaTeamRecords, tallied from
// TheSportsDB's season schedule -- see that function's own header for
// why it can't be tallied from the DB the way football's is).
//
// `status`/score DOES now reflect reality for a completed game: since
// src4 has no DB-level actual_home_score sync step (nba_predictions'
// own column exists but nothing writes it yet), nbaSchedule.ts's
// TheSportsDB fallback is checked for every row below -- same role as
// predictions.ts's "scheduleFinal" last resort, just without the ESPN
// live-in-progress tier above it (no NBA equivalent of that feed yet).
//
// `alias` on each TeamSide is the FULL display name ("Charlotte
// Hornets"), not the 3-letter code: there's no NBA equivalent of
// web/src/lib/teams.ts yet (no logos, no market/name split), and
// NbaMatchupCard (unlike the NFL MatchupCard) never calls
// teamByAlias()/teamLogoPath() on it -- it renders this string as-is.
//
// NBA has no "week" -- games are grouped by DATE instead, one slate per
// calendar day (America/New_York, matching formatKickoff's convention
// elsewhere in this codebase).

interface NbaPredictionRow {
  universal_game_id: string;
  season: number;
  home_team: string;
  home_team_name: string;
  away_team: string;
  away_team_name: string;
  game_date: Date;
  home_win_probability: number;
}

const PREDICTION_COLUMNS =
  "universal_game_id, season, home_team, home_team_name, away_team, away_team_name, game_date, home_win_probability";

// row.game_date is a real tipoff instant (src4/25/26 write the actual
// timestamp, e.g. "2026-10-25 21:00:00Z" = 5pm ET) -- needs a genuine
// America/New_York conversion to land on the correct ET calendar day,
// same as any other live timestamp. (It used to be a date-only value
// stamped at midnight UTC, which made a literal UTC-string-slice safe
// -- that's no longer true, and using the old slice here mis-bucketed
// any game after 8pm ET into the NEXT day's tab, caught live: a Friday
// 8pm ET slate was showing up under Saturday's date tab.)
function etDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(date);
}

export async function getAvailableNbaSeasons(): Promise<number[]> {
  const rows = await query<{ season: number }>(
    "SELECT DISTINCT season FROM latest_nba_predictions ORDER BY season DESC"
  );
  return rows.map((r) => r.season);
}

async function getAllRows(season: number): Promise<NbaPredictionRow[]> {
  return query<NbaPredictionRow>(
    `SELECT ${PREDICTION_COLUMNS} FROM latest_nba_predictions
     WHERE season = $1 ORDER BY game_date ASC`,
    [season]
  );
}

export async function getAvailableNbaDates(season: number): Promise<string[]> {
  const rows = await getAllRows(season);
  const dateKeys = new Set(rows.map((r) => etDateKey(r.game_date)));
  return Array.from(dateKeys).sort();
}

// Pure -- no DB access, so page.tsx can also run it on a MONTH-
// FILTERED slice of an already-fetched dates array (one query per
// page load either way, same "stored and easily retrievable" dates
// list this file already builds -- a month filter doesn't add a
// second round trip). "Today or the next date with games, else the
// season's last date" -- same rule for a whole season or one month.
function pickDefaultDate(dates: string[]): string | null {
  if (dates.length === 0) return null;
  const todayKey = etDateKey(new Date());
  return dates.find((d) => d >= todayKey) ?? dates[dates.length - 1];
}

export async function getDefaultNbaDate(season: number): Promise<string | null> {
  return pickDefaultDate(await getAvailableNbaDates(season));
}

// YYYY-MM keys actually present in `dates` -- not a fixed Oct-Jun
// template (a season still in progress, like the current one, only
// has the months it's actually reached so far; showing an empty "Jun"
// tab for a season sitting in October would be a dead end).
export function getNbaMonthsFromDates(dates: string[]): string[] {
  return Array.from(new Set(dates.map((d) => d.slice(0, 7))));
}

export function pickDefaultDateInMonth(dates: string[], month: string): string | null {
  return pickDefaultDate(dates.filter((d) => d.startsWith(month)));
}

export async function getMatchupsForNbaDate(season: number, dateKey: string): Promise<Matchup[]> {
  const rows = (await getAllRows(season)).filter((r) => etDateKey(r.game_date) === dateKey);
  const records = await getNbaTeamRecords(season, dateKey);

  return Promise.all(
    rows.map(async (row) => {
      const homeProb = Math.round(row.home_win_probability * 100);
      const awayProb = 100 - homeProb;

      const scheduled = await getNbaScheduledGame(row.home_team, row.away_team, row.game_date);
      const isFinal =
        scheduled?.final && scheduled.actualHomeScore !== null && scheduled.actualAwayScore !== null;
      // Same gap this project already found and fixed on the single-
      // game page (nbaGameDetail.ts's isLive) -- this list/home page
      // never checked it at all, so a game already in progress (real
      // score, real period) still showed "UPCOMING" with just a
      // pregame win probability. Confirmed live: an actual Nuggets/
      // Pelicans game was in overtime, 136-134, while this still read
      // "UPCOMING."
      const isLive =
        !isFinal && scheduled?.live && scheduled.actualHomeScore !== null && scheduled.actualAwayScore !== null;
      const hasScore = isFinal || isLive;

      const teamA: TeamSide = {
        alias: row.away_team_name,
        record: records.get(row.away_team) ?? "0-0",
        prob: awayProb,
        score: hasScore ? scheduled!.actualAwayScore! : undefined,
        winner: Boolean(hasScore) && scheduled!.actualAwayScore! > scheduled!.actualHomeScore!,
      };
      const teamB: TeamSide = {
        alias: row.home_team_name,
        record: records.get(row.home_team) ?? "0-0",
        prob: homeProb,
        score: hasScore ? scheduled!.actualHomeScore! : undefined,
        winner: Boolean(hasScore) && scheduled!.actualHomeScore! > scheduled!.actualAwayScore!,
      };
      // Same grading as football's predictions.ts computeCorrect() --
      // graded live too (not just once final), same as football's own
      // live?.status === "in" branch: a real-time lead is still real
      // information about whether the model's favorite is covering.
      // undefined (ungraded, neutral highlight) with no score yet or
      // a live tie; otherwise true only when the side the model
      // favored (>=50% win probability) is the side currently/finally
      // ahead.
      const predictionCorrect =
        !hasScore || scheduled!.actualHomeScore === scheduled!.actualAwayScore
          ? undefined
          : (row.home_win_probability >= 0.5) === (scheduled!.actualHomeScore! > scheduled!.actualAwayScore!);
      return {
        id: row.universal_game_id,
        status: isFinal ? "final" : isLive ? "live" : "preview",
        kickoff: isFinal
          ? "Final"
          : isLive
          ? scheduled!.period ?? "In Progress"
          : new Intl.DateTimeFormat("en-US", {
              weekday: "short",
              hour: "numeric",
              minute: "2-digit",
              timeZone: "America/New_York",
            }).format(row.game_date) + " ET",
        teamA,
        teamB,
        predictionCorrect,
      } satisfies Matchup;
    })
  );
}

export interface ConfidenceRecord {
  wins: number;
  losses: number;
}

// Same cheap SQL aggregate as NFL's predictions.ts's getConfidenceRecord,
// now that latest_nba_predictions.actual_home_score/actual_away_score
// are actually populated (SportsAnalytics' src4/42_grade_nba_games.py,
// 2026-11-09 -- backfilled from nba.games/hoopR, cron'd every 4 hours,
// no TheSportsDB calls). This used to walk every date in the season
// through getMatchupsForNbaDate's live-API-backed grading instead --
// real external calls on every cache miss, not a free DB read. Keep
// that history in mind if this table's grading ever regresses to NULL
// again: the old per-date walk is still the fallback pattern to reach
// for, not a dead end.
async function computeNbaConfidenceRecordLive(season: number, minProb: number): Promise<ConfidenceRecord> {
  const rows = await query<{ correct: string; incorrect: string }>(
    `SELECT
       COUNT(*) FILTER (WHERE pick_correct) AS correct,
       COUNT(*) FILTER (WHERE NOT pick_correct) AS incorrect
     FROM (
       SELECT
         CASE WHEN home_win_probability >= 0.5 THEN home_win_probability ELSE 1 - home_win_probability END AS pick_prob,
         CASE WHEN home_win_probability >= 0.5 THEN (actual_home_score > actual_away_score)
              ELSE (actual_away_score > actual_home_score) END AS pick_correct
       FROM latest_nba_predictions
       WHERE season = $1 AND actual_home_score IS NOT NULL AND actual_away_score IS NOT NULL
         AND actual_home_score <> actual_away_score
     ) t
     WHERE pick_prob >= $2`,
    [season, minProb]
  );
  const row = rows[0];
  return { wins: row ? Number(row.correct) : 0, losses: row ? Number(row.incorrect) : 0 };
}

// Same cache-then-live-fallback contract as predictions.ts's
// getConfidenceRecord -- see its own comment for why.
export async function getNbaConfidenceRecord(season: number, minProb: number): Promise<ConfidenceRecord> {
  try {
    const rows = await query<{ wins: number; losses: number }>(
      `SELECT wins, losses FROM confidence_record_cache WHERE league = 'nba' AND season = $1 AND min_prob = $2`,
      [season, minProb]
    );
    if (rows[0]) return { wins: rows[0].wins, losses: rows[0].losses };
  } catch (error) {
    console.error("confidence_record_cache read failed, falling back to live:", error instanceof Error ? error.message : error);
  }
  return computeNbaConfidenceRecordLive(season, minProb);
}

export interface NbaConfidenceGame {
  dateKey: string;
  gameDate: Date;
  matchup: Matchup;
}

interface GradedNbaRow {
  universal_game_id: string;
  home_team: string;
  home_team_name: string;
  away_team: string;
  away_team_name: string;
  game_date: Date;
  home_win_probability: number;
  actual_home_score: number;
  actual_away_score: number;
}

// NBA sibling of predictions.ts's getConfidenceGames -- the games
// behind an NBA getNbaConfidenceRecord() number. Builds Matchup
// objects directly from the row's own actual_home_score/
// actual_away_score (now real, thanks to src4/42_grade_nba_games.py)
// instead of getMatchupsForNbaDate's getNbaScheduledGame lookup --
// every row here is already graded by definition, so there's no live/
// upcoming case to handle and no reason to pay for that external call.
// No "week" (see this file's own header on NBA having none) -- grouped
// by ET calendar date instead, same convention as everywhere else NBA
// games are shown.
export async function getNbaConfidenceGames(season: number, minProb: number): Promise<NbaConfidenceGame[]> {
  const rows = await query<GradedNbaRow>(
    `SELECT universal_game_id, home_team, home_team_name, away_team, away_team_name,
            game_date, home_win_probability, actual_home_score, actual_away_score
     FROM latest_nba_predictions
     WHERE season = $1 AND actual_home_score IS NOT NULL AND actual_away_score IS NOT NULL
       AND actual_home_score <> actual_away_score
       AND (CASE WHEN home_win_probability >= 0.5 THEN home_win_probability ELSE 1 - home_win_probability END) >= $2
     ORDER BY game_date DESC`,
    [season, minProb]
  );

  const dateKeys = Array.from(new Set(rows.map((r) => etDateKey(r.game_date))));
  const recordsByDate = new Map<string, Map<string, string>>();
  for (const dateKey of dateKeys) {
    recordsByDate.set(dateKey, await getNbaTeamRecords(season, dateKey));
  }

  return rows.map((row) => {
    const dateKey = etDateKey(row.game_date);
    const records = recordsByDate.get(dateKey) ?? new Map();
    const homeProb = Math.round(row.home_win_probability * 100);
    const awayProb = 100 - homeProb;
    const homeWon = row.actual_home_score > row.actual_away_score;
    const predictionCorrect = (row.home_win_probability >= 0.5) === homeWon;

    const teamA: TeamSide = {
      alias: row.away_team_name,
      record: records.get(row.away_team) ?? "0-0",
      prob: awayProb,
      score: row.actual_away_score,
      winner: !homeWon,
    };
    const teamB: TeamSide = {
      alias: row.home_team_name,
      record: records.get(row.home_team) ?? "0-0",
      prob: homeProb,
      score: row.actual_home_score,
      winner: homeWon,
    };

    return {
      dateKey,
      gameDate: row.game_date,
      matchup: {
        id: row.universal_game_id,
        status: "final",
        // Date inside the card's own .game-meta slot (top-right,
        // otherwise a redundant "Final") instead of a separate label
        // outside it -- a sibling label there previously changed the
        // card's own rendered size (user, 2026-11-09: "go back to
        // previous size and move the date week inside the square").
        // No "week" for NBA, same as everywhere else in this file.
        kickoff: new Intl.DateTimeFormat("en-US", {
          timeZone: "UTC",
          month: "short",
          day: "numeric",
        }).format(new Date(`${dateKey}T12:00:00Z`)),
        teamA,
        teamB,
        predictionCorrect,
      },
    };
  });
}
