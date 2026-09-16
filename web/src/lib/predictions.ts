import "server-only";
import { query } from "@/lib/db";
import type { Matchup, TeamSide } from "@/lib/matchups";
import type { GameStat, GameStatSide } from "@/lib/gameStats";
import { getSeasonSchedule, getScheduleWeek, getScheduleWeeks, type ScheduleGame } from "@/lib/schedule";
import { getAllLiveScores, getLiveScore, type LiveScore } from "@/lib/liveScores";
import { getEffectiveNow, getActiveTimeOverride } from "@/lib/admin";

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
  // Same simulation evaluated at this game's own market_total_line_current
  // instead of a fixed threshold -- null on any row written before this
  // column existed (Files 58/59/60 back-fill it going forward, not
  // retroactively). See gameStats.ts's totals[].isMarketLine.
  total_over_market: number | null;
  total_under_market: number | null;
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
  total_under_30, total_under_40, total_under_44, total_under_48, total_under_52,
  total_over_market, total_under_market
`;

// NFL seasons span two calendar years -- "the current season" is this
// year from Sept through Dec, then still-last-year's season Jan/Feb.
//
// CHANGED: reads getEffectiveNow() (admin.ts) instead of `new Date()`
// directly -- for everyone except a signed-in admin with an active
// time override, that's exactly equivalent to `new Date()` (see
// admin.ts's own docstring for why the override never touches the
// real server clock, and is a no-op for non-admins even if someone
// tries to forge the cookie by hand).
export async function getCurrentSeasonYear(): Promise<number> {
  const now = await getEffectiveNow();
  return now.getMonth() < 2 ? now.getFullYear() - 1 : now.getFullYear();
}

// 2024/2025 are fully covered by the backfilled predictions table --
// no need to hit TheSportsDB for those on every request. Only the
// current/future season(s), where the model hasn't caught up to every
// game yet, need the schedule to show "games to come."
async function isScheduleEnabledSeason(season: number): Promise<boolean> {
  return season >= (await getCurrentSeasonYear());
}

export async function getAvailableSeasons(): Promise<number[]> {
  const rows = await query<{ season: number }>(
    "SELECT DISTINCT season FROM latest_predictions ORDER BY season DESC"
  );
  const seasons = new Set(rows.map((r) => r.season));

  const currentSeason = await getCurrentSeasonYear();
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

  if (await isScheduleEnabledSeason(season)) {
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
//
// UNDER AN ACTIVE ADMIN TIME OVERRIDE, this switches to a genuinely
// different algorithm (resolveWeekForSimulatedTime below) rather than
// just feeding the override time into the same real-data-completeness
// check: the whole point of the override is to preview a week whose
// games may not have happened (or been predicted) yet at all, which
// "is this week done in the DB" can never answer for a real user --
// there's nothing there to be done. This path is admin-only and never
// changes what a real visitor sees.
export async function getDefaultWeek(season: number): Promise<number | null> {
  const weeks = await getWeeksForSeason(season);
  if (weeks.length === 0) return null;

  const scheduleByWeek = new Map<number, ScheduleGame[]>();
  if (await isScheduleEnabledSeason(season)) {
    for (const g of await getSeasonSchedule(season)) {
      const list = scheduleByWeek.get(g.week) ?? [];
      list.push(g);
      scheduleByWeek.set(g.week, list);
    }
  }

  const override = await getActiveTimeOverride();
  if (override && scheduleByWeek.size > 0) {
    return resolveWeekForSimulatedTime(weeks, scheduleByWeek, override);
  }

  const dbRows = await query<{ week: number; total: string; final_count: string }>(
    `SELECT week, COUNT(*) AS total, COUNT(actual_home_score) AS final_count
     FROM latest_predictions WHERE season = $1 GROUP BY week`,
    [season]
  );
  const dbCompleteness = new Map(
    dbRows.map((r) => [r.week, { total: Number(r.total), final: Number(r.final_count) }])
  );

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

// Admin-only: which week would be "current" if the real clock read
// simulatedNow, reasoning purely from the real schedule's kickoff
// times -- NOT from whether predictions exist yet for that week. A
// week the model hasn't been run for at all is a completely valid,
// expected thing to land on here (that's the "I ran the model early
// for next week, does it look right" workflow this exists for) --
// getMatchupsForSeasonWeek/getPremierGame just show whatever real
// rows do or don't exist for whichever week this returns.
//
// A week counts as "done" once every one of its real scheduled games
// is either actually final, or far enough past its own kickoff
// (ASSUMED_GAME_DURATION_MS) that it would realistically be over by
// simulatedNow -- same estimate getPremierGame() uses, so the two
// stay consistent with each other for the same simulated instant.
// Weeks are scanned in order; the first one that isn't done yet wins.
function resolveWeekForSimulatedTime(
  weeks: number[],
  scheduleByWeek: Map<number, ScheduleGame[]>,
  simulatedNow: Date
): number {
  for (const week of weeks) {
    const games = scheduleByWeek.get(week);
    if (!games || games.length === 0) continue;
    const weekIsDone = games.every(
      (g) => g.final || simulatedNow.getTime() >= g.game_date.getTime() + ASSUMED_GAME_DURATION_MS
    );
    if (!weekIsDone) return week;
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
  if (await isScheduleEnabledSeason(season)) {
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

export function formatKickoff(gameDate: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  }).format(gameDate) + " ET";
}

// 0=Sunday ... 6=Saturday, evaluated in America/New_York local time --
// NFL scheduling (and the broadcast-window slots getPremierGame() below
// keys off) is ET-based, so a plain UTC Date.getDay() can land on the
// wrong day for a game_date stored as, say, 00:15 UTC Tuesday that's
// actually Monday night ET.
function etWeekday(date: Date): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
  }).format(date);
  const index: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return index[weekday] ?? -1;
}

// Was the model's favorite actually right? undefined when there's no
// real score yet, homeWinProbability isn't known (a schedule-only
// game with no prediction), or the game tied (rare in the NFL, but
// not impossible -- a tie isn't a "hit" or a "miss" for either side).
function computeCorrect(
  homeScore: number,
  awayScore: number,
  homeWinProbability: number | undefined
): boolean | undefined {
  if (homeWinProbability === undefined || homeScore === awayScore) return undefined;
  const homeFavored = homeWinProbability >= 0.5;
  const homeWon = homeScore > awayScore;
  return homeWon === homeFavored;
}

interface ResolvedGameState {
  status: "preview" | "live" | "final";
  homeScore: number | undefined;
  awayScore: number | undefined;
  kickoffText: string;
  predictionCorrect: boolean | undefined;
}

// Single source of truth for "what's actually happening with this
// game right now," shared by the matchup-list and game-detail
// builders below -- a DB row that's already been permanently graded
// (File 60 ran) always wins, since that's the one row with a
// prediction to compare against that's guaranteed not to change.
// Absent that, a live ESPN fetch fills in: "in" progress shows the
// current score under a LIVE tag, and "post" (ESPN says it's over,
// but our own sync job hasn't run yet) shows the real final score --
// and grades it against the model's probability immediately, rather
// than leaving the site showing a stale pregame percentage until the
// next scheduled sync.
function resolveGameState(
  gameDate: Date,
  dbActualHome: number | null,
  dbActualAway: number | null,
  live: LiveScore | undefined,
  homeWinProbability: number | undefined
): ResolvedGameState {
  if (dbActualHome !== null && dbActualAway !== null) {
    return {
      status: "final",
      homeScore: dbActualHome,
      awayScore: dbActualAway,
      kickoffText: "Final",
      predictionCorrect: computeCorrect(dbActualHome, dbActualAway, homeWinProbability),
    };
  }

  if (live?.status === "in") {
    return {
      status: "live",
      homeScore: live.home_score,
      awayScore: live.away_score,
      kickoffText: live.status_detail,
      predictionCorrect: computeCorrect(live.home_score, live.away_score, homeWinProbability),
    };
  }

  if (live?.status === "post") {
    return {
      status: "final",
      homeScore: live.home_score,
      awayScore: live.away_score,
      kickoffText: "Final",
      predictionCorrect: computeCorrect(live.home_score, live.away_score, homeWinProbability),
    };
  }

  return {
    status: "preview",
    homeScore: undefined,
    awayScore: undefined,
    kickoffText: formatKickoff(gameDate),
    predictionCorrect: undefined,
  };
}

function rowToMatchup(
  row: PredictionRow,
  records: Map<string, string>,
  live: LiveScore | undefined,
  priorHomeWinProbability?: number
): Matchup {
  const state = resolveGameState(
    row.game_date,
    row.actual_home_score,
    row.actual_away_score,
    live,
    row.home_win_probability
  );
  const homeProb = Math.round(row.home_win_probability * 100);
  const awayProb = 100 - homeProb;
  const showScore = state.status !== "preview";

  // Whichever side's own probability went up since the prior
  // prediction -- never both, never on a tie or a first-ever
  // prediction (priorHomeWinProbability undefined). Compares the
  // ROUNDED, displayed percentage, not the raw float: two predictions
  // can differ in the 4th decimal place (real, but genuinely
  // imperceptible) and still round to the exact same displayed number
  // -- an arrow next to a percentage that visibly hasn't moved would
  // just be confusing, so this only counts a change the user can
  // actually see.
  const priorHomeProb =
    priorHomeWinProbability !== undefined ? Math.round(priorHomeWinProbability * 100) : undefined;
  const homeTrendingUp = priorHomeProb !== undefined && homeProb > priorHomeProb;
  const awayTrendingUp = priorHomeProb !== undefined && homeProb < priorHomeProb;

  const teamA: TeamSide = {
    alias: row.away_team,
    record: records.get(row.away_team) ?? "0-0",
    // Shown for final/live games too, not just upcoming ones -- so a
    // historical game shows what was predicted next to what happened.
    prob: awayProb,
    score: showScore ? state.awayScore : undefined,
    winner: showScore && (state.awayScore ?? 0) > (state.homeScore ?? 0),
    trendingUp: awayTrendingUp,
  };
  const teamB: TeamSide = {
    alias: row.home_team,
    record: records.get(row.home_team) ?? "0-0",
    prob: homeProb,
    score: showScore ? state.homeScore : undefined,
    winner: showScore && (state.homeScore ?? 0) > (state.awayScore ?? 0),
    trendingUp: homeTrendingUp,
  };

  return {
    id: row.universal_game_id,
    status: state.status,
    kickoff: state.kickoffText,
    teamA,
    teamB,
    predictionCorrect: state.predictionCorrect,
  };
}

// A game whose kickoff is known (from the schedule) but that the
// model hasn't predicted yet -- no win probability to show, just who,
// when, and (once played/live) what's happening.
function scheduleGameToMatchup(game: ScheduleGame, records: Map<string, string>, live: LiveScore | undefined): Matchup {
  const state = resolveGameState(
    game.game_date,
    game.actual_home_score,
    game.actual_away_score,
    live,
    undefined // no model prediction to grade a schedule-only game against
  );
  const showScore = state.status !== "preview";

  const teamA: TeamSide = {
    alias: game.away_team,
    record: records.get(game.away_team) ?? "0-0",
    score: showScore ? state.awayScore : undefined,
    winner: showScore && (state.awayScore ?? 0) > (state.homeScore ?? 0),
  };
  const teamB: TeamSide = {
    alias: game.home_team,
    record: records.get(game.home_team) ?? "0-0",
    score: showScore ? state.homeScore : undefined,
    winner: showScore && (state.homeScore ?? 0) > (state.awayScore ?? 0),
  };
  return {
    id: game.universal_game_id,
    status: state.status,
    kickoff: state.kickoffText,
    teamA,
    teamB,
  };
}

// The SECOND-most-recent home_win_probability per game this week --
// i.e. what the model said just before its current (latest_predictions)
// number, so the UI can show a trending indicator. predictions is
// append-only (sql/001_predictions_schema.sql) and gets a fresh row
// every time serving/3 runs for a game, even when nothing about that
// specific game changed (a full-slate rerun writes every game, a
// selective rerun writes only the games that did change) -- so "the
// row before the latest" is genuinely "the previous real prediction,"
// not necessarily "yesterday's." A game with only one prediction ever
// (brand new) simply has no entry here -- rn=2 doesn't exist for it.
async function fetchPriorHomeWinProbabilities(season: number, week: number): Promise<Map<string, number>> {
  const rows = await query<{ universal_game_id: string; home_win_probability: number }>(
    `WITH ranked AS (
       SELECT universal_game_id, home_win_probability,
              ROW_NUMBER() OVER (PARTITION BY universal_game_id ORDER BY generated_at DESC) AS rn
       FROM predictions
       WHERE season = $1 AND week = $2
     )
     SELECT universal_game_id, home_win_probability FROM ranked WHERE rn = 2`,
    [season, week]
  );
  return new Map(rows.map((r) => [r.universal_game_id, r.home_win_probability]));
}

export async function getMatchupsForSeasonWeek(
  season: number,
  week: number,
  premier?: PremierGame | null
): Promise<Matchup[]> {
  const rows = await query<PredictionRow>(
    `SELECT ${PREDICTION_COLUMNS} FROM latest_predictions
     WHERE season = $1 AND week = $2 ORDER BY game_date ASC`,
    [season, week]
  );
  const records = await getTeamRecords(season, week);
  const priorProbabilities = await fetchPriorHomeWinProbabilities(season, week);
  const predicted = new Map(rows.map((row) => [row.universal_game_id, { row, date: row.game_date }]));

  // Only fetches for the current/future season -- live status is
  // never meaningful for a historical week, and ESPN's scoreboard is
  // always "the current week" anyway, so a lookup for any other week
  // just harmlessly finds nothing.
  const liveScores = (await isScheduleEnabledSeason(season)) ? await getAllLiveScores() : new Map<string, LiveScore>();
  const liveFor = (away: string, home: string) => liveScores.get(`${away}@${home}`);

  // Schedule fills in games the model hasn't gotten to yet (or games
  // the DB doesn't know finished) -- wherever a prediction already
  // exists for the same id, the model's numbers win; the schedule
  // only supplies rows with no prediction at all.
  const combined: { date: Date; matchup: Matchup }[] = [];
  const seen = new Set<string>();

  if (await isScheduleEnabledSeason(season)) {
    for (const g of await getScheduleWeek(season, week)) {
      seen.add(g.universal_game_id);
      const predictedEntry = predicted.get(g.universal_game_id);
      const live = liveFor(g.away_team, g.home_team);
      combined.push(
        predictedEntry
          ? {
              date: predictedEntry.date,
              matchup: rowToMatchup(predictedEntry.row, records, live, priorProbabilities.get(g.universal_game_id)),
            }
          : { date: g.game_date, matchup: scheduleGameToMatchup(g, records, live) }
      );
    }
  }

  for (const [id, { row, date }] of predicted) {
    if (seen.has(id)) continue;
    combined.push({
      date,
      matchup: rowToMatchup(row, records, liveFor(row.away_team, row.home_team), priorProbabilities.get(id)),
    });
  }

  combined.sort((a, b) => a.date.getTime() - b.date.getTime());

  return combined.map(({ matchup }) => {
    if (premier && matchup.id === premier.id) {
      matchup.premier = true;
      matchup.premierLabel = premier.label;
      matchup.lockOfWeek = premier.probability !== undefined && premier.probability >= LOCK_OF_WEEK_THRESHOLD;
    }
    return matchup;
  });
}

// A win probability at or above this (for whichever side is favored)
// is the "highly accurate" tier -- only the single most confident
// game of the week can ever earn the gold Lock of the Week treatment,
// and only when it actually clears this bar.
export const LOCK_OF_WEEK_THRESHOLD = 0.77;

export interface PremierGame {
  id: string;
  // undefined when this slot's game has no real model prediction yet
  // (a schedule-only game the model hasn't been run on) -- the card
  // still gets featured, just with no percentage to show, same as any
  // other not-yet-predicted matchup card.
  probability?: number;
  // The ribbon's day-specific text fragment (e.g. "SUNDAY NIGHT
  // SHOWDOWN") -- see premierLabelForGame() below. The UI wraps this
  // in "★ {label} — FREE PREVIEW" (or "★ FREE {label} — FREE PREVIEW"
  // for a non-member) -- PredictionsView.tsx owns that exact template,
  // this is just which words go in the middle.
  label: string;
}

// A hypothetical/future game (no real score, no live-status row --
// only possible under an admin's simulated-future time override, see
// admin.ts) is assumed over once this long past its own kickoff. Real
// data always overrides this the instant it exists; this only ever
// matters when there isn't any yet.
const ASSUMED_GAME_DURATION_MS = 3.5 * 60 * 60 * 1000;

interface PremierCandidate {
  universal_game_id: string;
  game_date: Date;
  home_team: string;
  away_team: string;
  home_win_probability?: number;
  actual_home_score: number | null;
  actual_away_score: number | null;
  scheduleFinal?: boolean; // true when the SCHEDULE (not the model) already knows this game is over
}

// Merges the real schedule (every game that's kicking off this week,
// whether or not the model has predicted it yet) with whatever real
// predictions exist -- same source-of-truth split
// getMatchupsForSeasonWeek already uses: the schedule supplies
// identity/kickoff/completion for a game with no prediction row yet,
// a real prediction's numbers always win where one exists. Without
// this, getPremierGame() could only ever feature a game the model had
// already been run on, which defeats the "preview a week before
// running the model on it" use case entirely -- there would be
// nothing to feature at all.
async function getPremierCandidates(season: number, week: number): Promise<PremierCandidate[]> {
  const predictionRows = await query<{
    universal_game_id: string;
    home_win_probability: number;
    game_date: Date;
    home_team: string;
    away_team: string;
    actual_home_score: number | null;
    actual_away_score: number | null;
  }>(
    `SELECT universal_game_id, home_win_probability, game_date, home_team, away_team,
            actual_home_score, actual_away_score
     FROM latest_predictions
     WHERE season = $1 AND week = $2`,
    [season, week]
  );
  const predictedById = new Map(predictionRows.map((r) => [r.universal_game_id, r]));

  if (!(await isScheduleEnabledSeason(season))) {
    // Fully historical season -- no external schedule call needed,
    // every game here is guaranteed to already have a real prediction.
    return predictionRows;
  }

  const candidates: PremierCandidate[] = [];
  const seen = new Set<string>();
  for (const g of await getScheduleWeek(season, week)) {
    seen.add(g.universal_game_id);
    const pred = predictedById.get(g.universal_game_id);
    candidates.push({
      universal_game_id: g.universal_game_id,
      game_date: g.game_date,
      home_team: g.home_team,
      away_team: g.away_team,
      home_win_probability: pred?.home_win_probability,
      actual_home_score: pred?.actual_home_score ?? g.actual_home_score,
      actual_away_score: pred?.actual_away_score ?? g.actual_away_score,
      scheduleFinal: g.final,
    });
  }
  // A predicted game the schedule feed doesn't (yet) know about --
  // shouldn't normally happen, but keep it rather than silently drop it.
  for (const r of predictionRows) {
    if (!seen.has(r.universal_game_id)) candidates.push(r);
  }
  return candidates;
}

// The ribbon's day-specific text fragment for whichever game ends up
// featured. Sunday is the one day that needs isSundayNight passed in
// separately -- etWeekday() alone can't tell a Sunday day game from
// Sunday Night Football, only getPremierGame() (which already knows
// which candidate it picked as sundayNightGame) can.
function premierLabelForGame(gameDate: Date, isSundayNight: boolean): string {
  const day = etWeekday(gameDate);
  if (day === 0) return isSundayNight ? "SUNDAY NIGHT SHOWDOWN" : "GAME OF THE WEEK";
  if (day === 1) return "MONDAY NIGHT CLASH";
  if (day === 6) return "SATURDAY  FOOTBALL SPECIAL";
  return "MID-WEEK FOOTBALL CLASH"; // Wed/Thu/Fri (and the never-really-happens Tue)
}

// Game of the Week: follows the NFL's own broadcast-window order, not
// a single "whatever's most lopsided" pick across the whole week --
//   1. Thursday Night Football, until it ends.
//   2. Then the highest-confidence Sunday DAY game (the model's pick
//      among that slate -- this is the one slot that's genuinely
//      confidence-driven, since there's no single scheduled marquee
//      Sunday-day game the way there is for the other three). If none
//      of that day's games have a real prediction yet, picks the
//      first one instead of guessing -- there's no meaningful "most
//      confident" without any real percentages to compare.
//   3. Then Sunday Night Football.
//   4. Then Monday Night Football.
// Once a slot's game has actually ended, the slot is skipped and the
// next one in line becomes the featured game -- so the first three
// stay only until they're done, then hand off automatically. If every
// slot for the week is over (or a slot doesn't exist that week -- a
// bye affecting MNF, say), falls back to the single highest-confidence
// game across the whole week so the spot never simply goes empty.
// Not handled: holiday slates with more than one Thursday game (e.g.
// Thanksgiving's three) -- picks the earliest chronologically among
// them rather than trying to rank a multi-game Thursday slot.
export async function getPremierGame(season: number, week: number): Promise<PremierGame | null> {
  const candidates = await getPremierCandidates(season, week);
  if (candidates.length === 0) return null;
  type Candidate = PremierCandidate;

  const liveScores = (await isScheduleEnabledSeason(season)) ? await getAllLiveScores() : new Map<string, LiveScore>();
  const effectiveNow = await getEffectiveNow();
  const activeOverride = await getActiveTimeOverride();

  // -1 sorts below every real percentage (confidence is always >= 0),
  // so "no prediction yet" candidates never win a confidence
  // comparison against one that has real data, but reduce() still
  // needs SOME value to compare when nothing does.
  const confidence = (c: Candidate) =>
    c.home_win_probability !== undefined ? Math.abs(c.home_win_probability - 0.5) : -1;
  const mostConfident = (list: Candidate[]): Candidate =>
    list.reduce((best, c) => (confidence(c) > confidence(best) ? c : best));
  const earliest = (list: Candidate[]): Candidate =>
    list.reduce((first, c) => (c.game_date < first.game_date ? c : first));
  const latest = (list: Candidate[]): Candidate =>
    list.reduce((last, c) => (c.game_date > last.game_date ? c : last));

  // A real final score or the schedule's own final flag always wins --
  // that's genuinely, permanently over regardless of any clock. "post"
  // live status is the same kind of fact (definitely already ended),
  // so it wins unconditionally too.
  //
  // "in" (currently, actually live right now) is different: under an
  // ACTIVE admin override, whether a real game happens to still be
  // playing in actual real-world time is irrelevant to the question
  // being asked ("what would this look like at the simulated time") --
  // it's simply not real-world evidence about anything at the
  // simulated instant. So "in" only blocks advancement for a REAL
  // visitor (no override); under a simulation, it's ignored and the
  // assumed-duration clock estimate decides instead, same as a game
  // with no live data at all.
  const hasEnded = (c: Candidate): boolean => {
    if (c.actual_home_score !== null && c.actual_away_score !== null) return true;
    if (c.scheduleFinal) return true;
    const live = liveScores.get(`${c.away_team}@${c.home_team}`);
    if (live?.status === "post") return true;
    if (live?.status === "in" && !activeOverride) return false;
    return effectiveNow.getTime() >= c.game_date.getTime() + ASSUMED_GAME_DURATION_MS;
  };

  const thursdayGames = candidates.filter((c) => etWeekday(c.game_date) === 4);
  const sundayGames = candidates.filter((c) => etWeekday(c.game_date) === 0);
  const mondayGames = candidates.filter((c) => etWeekday(c.game_date) === 1);

  const sundayNightGame = sundayGames.length > 0 ? latest(sundayGames) : undefined;
  const sundayDayGames = sundayGames.filter((c) => c !== sundayNightGame);

  const sequence = [
    thursdayGames.length > 0 ? earliest(thursdayGames) : undefined,
    sundayDayGames.length > 0 ? mostConfident(sundayDayGames) : undefined,
    sundayNightGame,
    mondayGames.length > 0 ? latest(mondayGames) : undefined,
  ].filter((c): c is Candidate => c !== undefined);

  const best = sequence.find((c) => !hasEnded(c)) ?? mostConfident(candidates);

  const probability =
    best.home_win_probability === undefined
      ? undefined
      : best.home_win_probability >= 0.5
        ? best.home_win_probability
        : 1 - best.home_win_probability;
  const label = premierLabelForGame(best.game_date, best === sundayNightGame);
  return { id: best.universal_game_id, probability, label };
}

// "-3.5" traditionally sits next to the favored team's name. Our
// stored value is positive-good-for-home, so a positive value means
// home is favored (shown next to home) and negative means away is
// favored by that same magnitude (shown next to away).
function spreadDisplay(row: PredictionRow): string {
  const favoredAlias = row.market_spread_line_current >= 0 ? row.home_team : row.away_team;
  return `${favoredAlias} -${Math.abs(row.market_spread_line_current).toFixed(1)}`;
}

function rowToGameStat(
  row: PredictionRow,
  records: Map<string, string>,
  live: LiveScore | undefined,
  priorHomeWinProbability?: number
): GameStat {
  const state = resolveGameState(
    row.game_date,
    row.actual_home_score,
    row.actual_away_score,
    live,
    row.home_win_probability
  );
  const homeProb = Math.round(row.home_win_probability * 100);
  const awayProb = 100 - homeProb;
  const homeFavored = row.home_win_probability >= 0.5;
  const showScore = state.status !== "preview";

  // Compares the ROUNDED, displayed percentage -- see rowToMatchup's
  // identical comment for why (a real but sub-percentage-point change
  // can round to the same displayed number either way).
  const priorHomeProb =
    priorHomeWinProbability !== undefined ? Math.round(priorHomeWinProbability * 100) : undefined;
  const homeTrendingUp = priorHomeProb !== undefined && homeProb > priorHomeProb;
  const awayTrendingUp = priorHomeProb !== undefined && homeProb < priorHomeProb;

  const teamA: GameStatSide = {
    alias: row.away_team,
    record: records.get(row.away_team) ?? "0-0",
    winProb: awayProb,
    score: showScore ? state.awayScore : undefined,
    winner: showScore && (state.awayScore ?? 0) > (state.homeScore ?? 0),
    trendingUp: awayTrendingUp,
  };
  const teamB: GameStatSide = {
    alias: row.home_team,
    record: records.get(row.home_team) ?? "0-0",
    winProb: homeProb,
    score: showScore ? state.homeScore : undefined,
    winner: showScore && (state.homeScore ?? 0) > (state.awayScore ?? 0),
    trendingUp: homeTrendingUp,
  };

  const marginBuckets = [
    { label: "Lost / Tied", pct: Math.round((row.margin_bucket_lost_or_tied ?? 0) * 100) },
    { label: "Won by 1-3", pct: Math.round((row.margin_bucket_won_1_3 ?? 0) * 100) },
    { label: "Won by 4-7", pct: Math.round((row.margin_bucket_won_4_7 ?? 0) * 100) },
    { label: "Won by 8-14", pct: Math.round((row.margin_bucket_won_8_14 ?? 0) * 100) },
    { label: "Won by 15-21", pct: Math.round((row.margin_bucket_won_15_21 ?? 0) * 100) },
    { label: "Won by 21+", pct: Math.round((row.margin_bucket_won_21_plus ?? 0) * 100) },
  ];

  const totals: GameStat["totals"] = [
    { line: 30, over: Math.round((row.total_over_30 ?? 0) * 100), under: Math.round((row.total_under_30 ?? 0) * 100) },
    { line: 40, over: Math.round((row.total_over_40 ?? 0) * 100), under: Math.round((row.total_under_40 ?? 0) * 100) },
    { line: 44, over: Math.round((row.total_over_44 ?? 0) * 100), under: Math.round((row.total_under_44 ?? 0) * 100) },
    { line: 48, over: Math.round((row.total_over_48 ?? 0) * 100), under: Math.round((row.total_under_48 ?? 0) * 100) },
    { line: 52, over: Math.round((row.total_over_52 ?? 0) * 100), under: Math.round((row.total_under_52 ?? 0) * 100) },
  ];

  // A sixth row for the game's ACTUAL market total (e.g. 48.5), not
  // just its two nearest fixed neighbors above -- null on rows written
  // before total_over_market/total_under_market existed, in which
  // case there's nothing real to show and the row is just omitted
  // rather than faked from an interpolation.
  if (row.total_over_market !== null && row.total_under_market !== null) {
    totals.push({
      line: row.market_total_line_current,
      over: Math.round(row.total_over_market * 100),
      under: Math.round(row.total_under_market * 100),
      isMarketLine: true,
    });
    totals.sort((a, b) => a.line - b.line);
  }

  return {
    status: state.status,
    kickoff: state.kickoffText,
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
      showScore && state.homeScore !== undefined && state.awayScore !== undefined && state.status === "final"
        ? {
            winnerAlias: state.homeScore > state.awayScore ? row.home_team : row.away_team,
            margin: Math.abs(state.homeScore - state.awayScore),
            totalScore: state.homeScore + state.awayScore,
          }
        : undefined,
    predictionCorrect: state.predictionCorrect,
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
  const live = (await isScheduleEnabledSeason(row.season)) ? await getLiveScore(row.away_team, row.home_team) : null;

  const priorRows = await query<{ home_win_probability: number }>(
    `SELECT home_win_probability FROM predictions
     WHERE universal_game_id = $1
     ORDER BY generated_at DESC OFFSET 1 LIMIT 1`,
    [universalGameId]
  );
  const priorHomeWinProbability = priorRows[0]?.home_win_probability;

  const game = rowToGameStat(row, records, live ?? undefined, priorHomeWinProbability);
  const premier = await getPremierGame(row.season, row.week);
  if (premier && premier.id === row.universal_game_id) {
    game.premier = true;
    game.lockOfWeek = premier.probability !== undefined && premier.probability >= LOCK_OF_WEEK_THRESHOLD;
  }
  return game;
}
