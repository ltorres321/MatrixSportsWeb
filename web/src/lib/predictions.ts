import "server-only";
import { query } from "@/lib/db";
import type { Matchup, TeamSide } from "@/lib/matchups";
import type { GameStat, GameStatSide } from "@/lib/gameStats";
import { getSeasonSchedule, getScheduleWeek, getScheduleWeeks, type ScheduleGame } from "@/lib/schedule";

// Real data layer over the predictions/latest_predictions table that
// SportsAnalytics (a separate repo/pipeline) writes into. This file
// only ever SELECTs -- see src/lib/db.ts and SportsAnalytics's
// sql/001_predictions_schema.sql for the append-only contract on the
// other side of this connection.
//
// SIGN CONVENTION: market_spread_line_current is stored "positive =
// good for home" (SportsAnalytics File 57 negates the standard
// bettor-facing feed to get this) -- same convention as margin
// (home_score - away_score) and as the mean the Monte Carlo sim draws
// around. So a NEGATIVE value means the home team is the underdog,
// not the favorite -- see spreadDisplay() below before touching that
// sign.
//
// MARGIN BUCKETS/PERCENTILES ARE HOME-TEAM PERSPECTIVE, ALWAYS. The
// bucket columns (margin_bucket_won_1_3, etc.) only break out the
// winning side's margin ranges for whichever side is winning in that
// simulated draw -- when the home team is the projected underdog,
// "lost or tied" lumps together every losing margin without
// preserving how big the loss was, so there is no way to reconstruct
// the away/favored team's own bucketed margin from what's stored.
// That's why the UI below always labels these sections by the HOME
// team, never by "the favored team" -- flipping the frame for an
// away-favorite game would silently misrepresent the data.
export interface PredictionRow {
  universal_game_id: string;
  season: number;
  week: number;
  home_team: string;
  away_team: string;
  game_date: Date;
  market_spread_line_current: number;
  market_total_line_current: number;
  home_win_probability: number;
  expected_home_score: number;
  expected_away_score: number;
  margin_p05: number | null;
  margin_p25: number | null;
  margin_p50: number | null;
  margin_p75: number | null;
  margin_p95: number | null;
  actual_home_score: number | null;
  actual_away_score: number | null;
  margin_bucket_lost_or_tied: number | null;
  margin_bucket_won_1_3: number | null;
  margin_bucket_won_4_7: number | null;
  margin_bucket_won_8_14: number | null;
  margin_bucket_won_15_21: number | null;
  margin_bucket_won_21_plus: number | null;
  total_over_30: number | null;
  total_over_40: number | null;
  total_over_44: number | null;
  total_over_48: number | null;
  total_over_52: number | null;
  total_under_30: number | null;
  total_under_40: number | null;
  total_under_44: number | null;
  total_under_48: number | null;
  total_under_52: number | null;
}

const PREDICTION_COLUMNS = `
  universal_game_id, season, week, home_team, away_team, game_date,
  market_spread_line_current, market_total_line_current,
  home_win_probability, expected_home_score, expected_away_score,
  margin_p05, margin_p25, margin_p50, margin_p75, margin_p95,
  actual_home_score, actual_away_score,
  margin_bucket_lost_or_tied, margin_bucket_won_1_3, margin_bucket_won_4_7,
  margin_bucket_won_8_14, margin_bucket_won_15_21, margin_bucket_won_21_plus,
  total_over_30, total_over_40, total_over_44, total_over_48, total_over_52,
  total_under_30, total_under_40, total_under_44, total_under_48, total_under_52
`;

// NFL seasons span two calendar years -- "the current season" is this
// year from Sept through Dec, then still-last-year's season Jan/Feb.
export function getCurrentSeasonYear(): number {
  const now = new Date();
  return now.getMonth() < 2 ? now.getFullYear() - 1 : now.getFullYear();
}

// 2024/2025 are fully covered by the backfilled predictions table --
// no need to hit TheSportsDB for those on every request. Only the
// current/future season(s), where the model hasn't caught up to every
// game yet, need the schedule to show "games to come."
function isScheduleEnabledSeason(season: number): boolean {
  return season >= getCurrentSeasonYear();
}

export async function getAvailableSeasons(): Promise<number[]> {
  const rows = await query<{ season: number }>(
    "SELECT DISTINCT season FROM latest_predictions ORDER BY season DESC"
  );
  const seasons = new Set(rows.map((r) => r.season));

  const currentSeason = getCurrentSeasonYear();
  if (!seasons.has(currentSeason)) {
    const scheduleGames = await getSeasonSchedule(currentSeason);
    if (scheduleGames.length > 0) seasons.add(currentSeason);
  }

  return Array.from(seasons).sort((a, b) => b - a);
}

export async function getWeeksForSeason(season: number): Promise<number[]> {
  const rows = await query<{ week: number }>(
    "SELECT DISTINCT week FROM latest_predictions WHERE season = $1 ORDER BY week ASC",
    [season]
  );
  const weeks = new Set(rows.map((r) => r.week));

  if (isScheduleEnabledSeason(season)) {
    for (const w of await getScheduleWeeks(season)) weeks.add(w);
  }

  return Array.from(weeks).sort((a, b) => a - b);
}

// Default week to show: the first week that isn't fully final yet, so
// the homepage opens on "what's coming up" rather than always the
// season's last week. A week with real schedule data trusts the
// schedule's own final/not-final status (it's the live source of
// truth for "is this actually over"); otherwise falls back to whether
// every game in that week has a real score in the DB. Falls back to
// the latest week if the whole season is final.
export async function getDefaultWeek(season: number): Promise<number | null> {
  const weeks = await getWeeksForSeason(season);
  if (weeks.length === 0) return null;

  const dbRows = await query<{ week: number; total: string; final_count: string }>(
    `SELECT week, COUNT(*) AS total, COUNT(actual_home_score) AS final_count
     FROM latest_predictions WHERE season = $1 GROUP BY week`,
    [season]
  );
  const dbCompleteness = new Map(
    dbRows.map((r) => [r.week, { total: Number(r.total), final: Number(r.final_count) }])
  );

  const scheduleByWeek = new Map<number, ScheduleGame[]>();
  if (isScheduleEnabledSeason(season)) {
    for (const g of await getSeasonSchedule(season)) {
      const list = scheduleByWeek.get(g.week) ?? [];
      list.push(g);
      scheduleByWeek.set(g.week, list);
    }
  }

  for (const week of weeks) {
    const scheduled = scheduleByWeek.get(week);
    if (scheduled && scheduled.length > 0) {
      if (!scheduled.every((g) => g.final)) return week;
      continue;
    }
    const c = dbCompleteness.get(week);
    if (c && c.final < c.total) return week;
  }
  return weeks[weeks.length - 1];
}

// Win/loss/tie record for every team, counting only games strictly
// before `throughWeek` with a real final score -- i.e. "their record
// entering this week's games," matching how a record is normally
// displayed next to a matchup.
async function getTeamRecords(season: number, throughWeek: number): Promise<Map<string, string>> {
  const rows = await query<{ universal_game_id: string; week: number; team: string; team_score: number; opp_score: number }>(
    `WITH results AS (
       SELECT universal_game_id, week, home_team AS team, actual_home_score AS team_score, actual_away_score AS opp_score
       FROM latest_predictions WHERE season = $1 AND actual_home_score IS NOT NULL
       UNION ALL
       SELECT universal_game_id, week, away_team AS team, actual_away_score AS team_score, actual_home_score AS opp_score
       FROM latest_predictions WHERE season = $1 AND actual_home_score IS NOT NULL
     )
     SELECT universal_game_id, week, team, team_score, opp_score FROM results WHERE week < $2`,
    [season, throughWeek]
  );

  const tally = new Map<string, { w: number; l: number; t: number }>();
  const bump = (team: string, key: "w" | "l" | "t") => {
    const cur = tally.get(team) ?? { w: 0, l: 0, t: 0 };
    cur[key]++;
    tally.set(team, cur);
  };
  for (const r of rows) {
    if (r.team_score > r.opp_score) bump(r.team, "w");
    else if (r.team_score < r.opp_score) bump(r.team, "l");
    else bump(r.team, "t");
  }

  // Fold in schedule-final games not yet reflected in the DB (e.g. a
  // 2026 game the model hasn't been re-run on since it finished) --
  // skip any id already counted above so a game is never double
  // counted once its prediction row does pick up a real score.
  if (isScheduleEnabledSeason(season)) {
    const alreadyCounted = new Set(rows.map((r) => r.universal_game_id));
    for (const g of await getSeasonSchedule(season)) {
      if (g.week >= throughWeek || !g.final || alreadyCounted.has(g.universal_game_id)) continue;
      const homeScore = g.actual_home_score ?? 0;
      const awayScore = g.actual_away_score ?? 0;
      if (homeScore > awayScore) {
        bump(g.home_team, "w");
        bump(g.away_team, "l");
      } else if (homeScore < awayScore) {
        bump(g.home_team, "l");
        bump(g.away_team, "w");
      } else {
        bump(g.home_team, "t");
        bump(g.away_team, "t");
      }
    }
  }

  const map = new Map<string, string>();
  for (const [team, rec] of tally) {
    map.set(team, rec.t > 0 ? `${rec.w}-${rec.l}-${rec.t}` : `${rec.w}-${rec.l}`);
  }
  return map;
}

function statusFor(row: PredictionRow): "preview" | "final" {
  // No live in-progress score feed exists yet -- every game is either
  // "not played" or "final," never "live," until that's wired up.
  return row.actual_home_score !== null ? "final" : "preview";
}

export function formatKickoff(gameDate: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  }).format(gameDate) + " ET";
}

function rowToMatchup(row: PredictionRow, records: Map<string, string>): Matchup {
  const status = statusFor(row);
  const homeProb = Math.round(row.home_win_probability * 100);
  const awayProb = 100 - homeProb;

  const teamA: TeamSide = {
    alias: row.away_team,
    record: records.get(row.away_team) ?? "0-0",
    prob: status === "final" ? undefined : awayProb,
    score: status === "final" ? row.actual_away_score ?? undefined : undefined,
    winner: status === "final" && (row.actual_away_score ?? 0) > (row.actual_home_score ?? 0),
  };
  const teamB: TeamSide = {
    alias: row.home_team,
    record: records.get(row.home_team) ?? "0-0",
    prob: status === "final" ? undefined : homeProb,
    score: status === "final" ? row.actual_home_score ?? undefined : undefined,
    winner: status === "final" && (row.actual_home_score ?? 0) > (row.actual_away_score ?? 0),
  };

  return {
    id: row.universal_game_id,
    status,
    kickoff: status === "final" ? "Final" : formatKickoff(row.game_date),
    teamA,
    teamB,
  };
}

// A game whose kickoff is known (from the schedule) but that the
// model hasn't predicted yet -- no win probability to show, just who,
// when, and (once played) what actually happened.
function scheduleGameToMatchup(game: ScheduleGame, records: Map<string, string>): Matchup {
  const status = game.final ? "final" : "preview";
  const teamA: TeamSide = {
    alias: game.away_team,
    record: records.get(game.away_team) ?? "0-0",
    score: status === "final" ? game.actual_away_score ?? undefined : undefined,
    winner: status === "final" && (game.actual_away_score ?? 0) > (game.actual_home_score ?? 0),
  };
  const teamB: TeamSide = {
    alias: game.home_team,
    record: records.get(game.home_team) ?? "0-0",
    score: status === "final" ? game.actual_home_score ?? undefined : undefined,
    winner: status === "final" && (game.actual_home_score ?? 0) > (game.actual_away_score ?? 0),
  };
  return {
    id: game.universal_game_id,
    status,
    kickoff: status === "final" ? "Final" : formatKickoff(game.game_date),
    teamA,
    teamB,
  };
}

export async function getMatchupsForSeasonWeek(
  season: number,
  week: number,
  premierGameId?: string
): Promise<Matchup[]> {
  const rows = await query<PredictionRow>(
    `SELECT ${PREDICTION_COLUMNS} FROM latest_predictions
     WHERE season = $1 AND week = $2 ORDER BY game_date ASC`,
    [season, week]
  );
  const records = await getTeamRecords(season, week);
  const predicted = new Map(rows.map((row) => [row.universal_game_id, { row, date: row.game_date }]));

  // Schedule fills in games the model hasn't gotten to yet (or games
  // the DB doesn't know finished) -- wherever a prediction already
  // exists for the same id, the model's numbers win; the schedule
  // only supplies rows with no prediction at all.
  const combined: { date: Date; matchup: Matchup }[] = [];
  const seen = new Set<string>();

  if (isScheduleEnabledSeason(season)) {
    for (const g of await getScheduleWeek(season, week)) {
      seen.add(g.universal_game_id);
      const predictedEntry = predicted.get(g.universal_game_id);
      combined.push(
        predictedEntry
          ? { date: predictedEntry.date, matchup: rowToMatchup(predictedEntry.row, records) }
          : { date: g.game_date, matchup: scheduleGameToMatchup(g, records) }
      );
    }
  }

  for (const [id, { row, date }] of predicted) {
    if (seen.has(id)) continue;
    combined.push({ date, matchup: rowToMatchup(row, records) });
  }

  combined.sort((a, b) => a.date.getTime() - b.date.getTime());

  return combined.map(({ matchup }) => {
    if (premierGameId && matchup.id === premierGameId) matchup.premier = true;
    return matchup;
  });
}

// Game of the Week: among this week's games, whichever the model is
// most confident about (win probability furthest from a coin flip).
// Picking the marquee free game from real model output rather than a
// hardcoded id.
export async function getPremierGameId(season: number, week: number): Promise<string | null> {
  const rows = await query<{ universal_game_id: string; home_win_probability: number }>(
    `SELECT universal_game_id, home_win_probability FROM latest_predictions
     WHERE season = $1 AND week = $2`,
    [season, week]
  );
  if (rows.length === 0) return null;
  let best = rows[0];
  let bestConfidence = Math.abs(best.home_win_probability - 0.5);
  for (const r of rows) {
    const confidence = Math.abs(r.home_win_probability - 0.5);
    if (confidence > bestConfidence) {
      best = r;
      bestConfidence = confidence;
    }
  }
  return best.universal_game_id;
}

// "-3.5" traditionally sits next to the favored team's name. Our
// stored value is positive-good-for-home, so a positive value means
// home is favored (shown next to home) and negative means away is
// favored by that same magnitude (shown next to away).
function spreadDisplay(row: PredictionRow): string {
  const favoredAlias = row.market_spread_line_current >= 0 ? row.home_team : row.away_team;
  return `${favoredAlias} -${Math.abs(row.market_spread_line_current).toFixed(1)}`;
}

function rowToGameStat(row: PredictionRow, records: Map<string, string>): GameStat {
  const status = statusFor(row);
  const homeProb = Math.round(row.home_win_probability * 100);
  const awayProb = 100 - homeProb;
  const homeFavored = row.home_win_probability >= 0.5;

  const teamA: GameStatSide = {
    alias: row.away_team,
    record: records.get(row.away_team) ?? "0-0",
    winProb: awayProb,
    score: status === "final" ? row.actual_away_score ?? undefined : undefined,
    winner: status === "final" && (row.actual_away_score ?? 0) > (row.actual_home_score ?? 0),
  };
  const teamB: GameStatSide = {
    alias: row.home_team,
    record: records.get(row.home_team) ?? "0-0",
    winProb: homeProb,
    score: status === "final" ? row.actual_home_score ?? undefined : undefined,
    winner: status === "final" && (row.actual_home_score ?? 0) > (row.actual_away_score ?? 0),
  };

  const marginBuckets = [
    { label: "Lost / Tied", pct: Math.round((row.margin_bucket_lost_or_tied ?? 0) * 100) },
    { label: "Won by 1-3", pct: Math.round((row.margin_bucket_won_1_3 ?? 0) * 100) },
    { label: "Won by 4-7", pct: Math.round((row.margin_bucket_won_4_7 ?? 0) * 100) },
    { label: "Won by 8-14", pct: Math.round((row.margin_bucket_won_8_14 ?? 0) * 100) },
    { label: "Won by 15-21", pct: Math.round((row.margin_bucket_won_15_21 ?? 0) * 100) },
    { label: "Won by 21+", pct: Math.round((row.margin_bucket_won_21_plus ?? 0) * 100) },
  ];

  const totals = [
    { line: 30, over: Math.round((row.total_over_30 ?? 0) * 100), under: Math.round((row.total_under_30 ?? 0) * 100) },
    { line: 40, over: Math.round((row.total_over_40 ?? 0) * 100), under: Math.round((row.total_under_40 ?? 0) * 100) },
    { line: 44, over: Math.round((row.total_over_44 ?? 0) * 100), under: Math.round((row.total_under_44 ?? 0) * 100) },
    { line: 48, over: Math.round((row.total_over_48 ?? 0) * 100), under: Math.round((row.total_under_48 ?? 0) * 100) },
    { line: 52, over: Math.round((row.total_over_52 ?? 0) * 100), under: Math.round((row.total_under_52 ?? 0) * 100) },
  ];

  return {
    status,
    kickoff: status === "final" ? "Final" : formatKickoff(row.game_date),
    marketLine: { spread: spreadDisplay(row), total: row.market_total_line_current },
    teamA,
    teamB,
    // "favored" always resolves to whichever of teamA/teamB is the
    // HOME side's counterpart when home is favored, else away -- see
    // module header on why the underlying buckets can't be re-framed
    // around the favorite when the home team is the underdog.
    favored: homeFavored ? "teamB" : "teamA",
    expectedScore: { teamA: row.expected_away_score, teamB: row.expected_home_score },
    marginBuckets,
    marginPercentiles: {
      p05: Math.round(row.margin_p05 ?? 0),
      p25: Math.round(row.margin_p25 ?? 0),
      p50: Math.round(row.margin_p50 ?? 0),
      p75: Math.round(row.margin_p75 ?? 0),
      p95: Math.round(row.margin_p95 ?? 0),
    },
    totals,
    finalResult:
      status === "final" && row.actual_home_score !== null && row.actual_away_score !== null
        ? {
            winnerAlias:
              row.actual_home_score > row.actual_away_score ? row.home_team : row.away_team,
            margin: Math.abs(row.actual_home_score - row.actual_away_score),
            totalScore: row.actual_home_score + row.actual_away_score,
          }
        : undefined,
  };
}

export async function getGameDetail(universalGameId: string): Promise<GameStat | null> {
  const rows = await query<PredictionRow>(
    `SELECT ${PREDICTION_COLUMNS} FROM latest_predictions WHERE universal_game_id = $1`,
    [universalGameId]
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  const records = await getTeamRecords(row.season, row.week);
  const game = rowToGameStat(row, records);
  const premierId = await getPremierGameId(row.season, row.week);
  if (premierId === row.universal_game_id) game.premier = true;
  return game;
}
