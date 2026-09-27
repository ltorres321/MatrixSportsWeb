import "server-only";
import { query } from "@/lib/db";

// Read layer over the four tables added by SportsPipelines/sql/
// 006_pff_game_report.sql (etl.pff_team_efficiency, pff_player_grades,
// pff_qb_matchup_stats, pff_team_pressure) -- written by
// SportsPipelines/pff_api/poll_game_report.py, straight from PFF's own
// Developer API. Same "server-only, plain SELECT, typed row mapper"
// convention as pffGrades.ts. The fifth report section, "Team Grades,"
// isn't here -- it reuses etl.pff_team_grades and lives in
// pffGrades.ts's getGameTeamGrades() instead, since that's the same
// table/file "Who Has the Edge?" already reads.

export interface StatWithRank {
  value: number;
  rank: number | null;
}

function statOrNull(value: unknown, rank: unknown): StatWithRank | null {
  return typeof value === "number" ? { value, rank: typeof rank === "number" ? rank : null } : null;
}

// ----------------------------------------------------------------------
// Efficiency and Scoring
// ----------------------------------------------------------------------

export interface TeamEfficiency {
  epaPerPlay: StatWithRank | null;
  epaPerPlayPassing: StatWithRank | null;
  epaPerPlayRushing: StatWithRank | null;
  successRate: StatWithRank | null;
  successRatePassing: StatWithRank | null;
  successRateRushing: StatWithRank | null;
  // "Points Per Game" -- scored per game for an offense-side row,
  // ALLOWED per game for a defense-side row (see module note on
  // pointsAllowedPerGame below). Label is the caller's job.
  pointsPerGame: StatWithRank | null;
}

export interface GameEfficiency {
  homeOffense: TeamEfficiency;
  awayOffense: TeamEfficiency;
  homeDefense: TeamEfficiency;
  awayDefense: TeamEfficiency;
}

interface EfficiencyRow {
  team: string;
  side: string;
  stats: {
    overall?: Record<string, unknown>;
    passing?: Record<string, unknown>;
    rushing?: Record<string, unknown>;
    pointsPerGame?: number;
    pointsPerGameRank?: number;
    pointsAllowedPerGame?: number;
    pointsAllowedPerGameRank?: number;
  };
}

// Field names differ between the offense-side and defense-side v2
// categories the poller pulled from (e.g. epaPerPlay vs
// epaPerPlayAllowed) -- see poll_game_report.py's module docstring.
function mapEfficiencyRow(side: "offense" | "defense", row: EfficiencyRow): TeamEfficiency {
  const overall = row.stats.overall ?? {};
  const passing = row.stats.passing ?? {};
  const rushing = row.stats.rushing ?? {};
  if (side === "offense") {
    return {
      epaPerPlay: statOrNull(overall.epaPerPlay, overall.epaPerPlayRank),
      epaPerPlayPassing: statOrNull(passing.epaPerPassPlay, passing.epaPerPassPlayRank),
      epaPerPlayRushing: statOrNull(rushing.epaPerRunPlay, rushing.epaPerRunPlayRank),
      successRate: statOrNull(overall.successRate, overall.successRateRank),
      successRatePassing: statOrNull(passing.passSuccessRate, passing.passSuccessRateRank),
      successRateRushing: statOrNull(rushing.rushSuccessRate, rushing.rushSuccessRateRank),
      pointsPerGame: statOrNull(row.stats.pointsPerGame, row.stats.pointsPerGameRank),
    };
  }
  return {
    epaPerPlay: statOrNull(overall.epaPerPlayAllowed, overall.epaPerPlayAllowedRank),
    epaPerPlayPassing: statOrNull(passing.epaPerPassPlayAllowed, passing.epaPerPassPlayAllowedRank),
    epaPerPlayRushing: statOrNull(rushing.epaPerRunPlayAllowed, rushing.epaPerRunPlayAllowedRank),
    successRate: statOrNull(overall.successRateAllowed, overall.successRateAllowedRank),
    successRatePassing: statOrNull(passing.passSuccessRateAllowed, passing.passSuccessRateAllowedRank),
    successRateRushing: statOrNull(rushing.rushSuccessRateAllowed, rushing.rushSuccessRateAllowedRank),
    pointsPerGame: statOrNull(row.stats.pointsAllowedPerGame, row.stats.pointsAllowedPerGameRank),
  };
}

const EMPTY_EFFICIENCY: TeamEfficiency = {
  epaPerPlay: null,
  epaPerPlayPassing: null,
  epaPerPlayRushing: null,
  successRate: null,
  successRatePassing: null,
  successRateRushing: null,
  pointsPerGame: null,
};

export async function getGameEfficiency(
  season: number,
  homeTeam: string,
  awayTeam: string
): Promise<GameEfficiency | null> {
  const rows = await query<EfficiencyRow>(
    `SELECT team, side, stats FROM etl.pff_team_efficiency WHERE season = $1 AND team IN ($2, $3)`,
    [season, homeTeam, awayTeam]
  );
  if (rows.length === 0) return null;

  function find(team: string, side: "offense" | "defense"): TeamEfficiency {
    const row = rows.find((r) => r.team === team && r.side === side);
    return row ? mapEfficiencyRow(side, row) : EMPTY_EFFICIENCY;
  }

  return {
    homeOffense: find(homeTeam, "offense"),
    awayOffense: find(awayTeam, "offense"),
    homeDefense: find(homeTeam, "defense"),
    awayDefense: find(awayTeam, "defense"),
  };
}

// ----------------------------------------------------------------------
// Highest Graded Players
// ----------------------------------------------------------------------

export interface PlayerGrade {
  pffPlayerId: number;
  name: string;
  position: string | null;
  grade: number;
  snapShare: number | null;
  espnId: string | null;
}

export interface TeamPlayerGrades {
  offense: PlayerGrade[];
  defense: PlayerGrade[];
}

export interface GamePlayerGrades {
  home: TeamPlayerGrades;
  away: TeamPlayerGrades;
}

interface PlayerGradeRow {
  team: string;
  side: string;
  pff_player_id: number;
  player_name: string;
  position: string | null;
  grade: number;
  snap_share: number | null;
  espn_id: string | null;
}

export async function getGamePlayerGrades(
  season: number,
  homeTeam: string,
  awayTeam: string
): Promise<GamePlayerGrades | null> {
  const rows = await query<PlayerGradeRow>(
    `SELECT team, side, pff_player_id, player_name, position, grade, snap_share, espn_id
     FROM etl.pff_player_grades
     WHERE season = $1 AND team IN ($2, $3)
     ORDER BY team, side, grade DESC`,
    [season, homeTeam, awayTeam]
  );
  if (rows.length === 0) return null;

  function build(team: string): TeamPlayerGrades {
    function side(s: "offense" | "defense"): PlayerGrade[] {
      return rows
        .filter((r) => r.team === team && r.side === s)
        .map((r) => ({
          pffPlayerId: r.pff_player_id,
          name: r.player_name,
          position: r.position,
          grade: r.grade,
          snapShare: r.snap_share,
          espnId: r.espn_id,
        }));
    }
    return { offense: side("offense"), defense: side("defense") };
  }

  const home = build(homeTeam);
  const away = build(awayTeam);
  const isEmpty = (t: TeamPlayerGrades) => t.offense.length === 0 && t.defense.length === 0;
  if (isEmpty(home) && isEmpty(away)) return null;
  return { home, away };
}

// ----------------------------------------------------------------------
// QB Matchup
// ----------------------------------------------------------------------

export interface QbMatchupStat {
  playerId: number;
  name: string;
  espnId: string | null;
  qualifyingCount: number;
  overall: StatWithRank | null;
  cleanPocket: StatWithRank | null;
  pressure: StatWithRank | null;
  bigTimeThrowPct: StatWithRank | null;
  turnoverWorthyPct: StatWithRank | null;
  avgTimeToThrow: StatWithRank | null;
  avgDepthOfTarget: StatWithRank | null;
}

export interface GameQbMatchup {
  home: QbMatchupStat;
  away: QbMatchupStat;
}

interface QbMatchupRow {
  team: string;
  pff_player_id: number;
  player_name: string;
  espn_id: string | null;
  qualifying_qb_count: number;
  overall_grade: number | null;
  overall_rank: number | null;
  clean_pocket_grade: number | null;
  clean_pocket_rank: number | null;
  pressure_grade: number | null;
  pressure_rank: number | null;
  big_time_throw_pct: number | null;
  big_time_throw_rank: number | null;
  turnover_worthy_pct: number | null;
  turnover_worthy_rank: number | null;
  avg_time_to_throw: number | null;
  avg_time_to_throw_rank: number | null;
  avg_depth_of_target: number | null;
  avg_depth_of_target_rank: number | null;
}

function rowToQbStat(row: QbMatchupRow): QbMatchupStat {
  return {
    playerId: row.pff_player_id,
    name: row.player_name,
    espnId: row.espn_id,
    qualifyingCount: row.qualifying_qb_count,
    overall: statOrNull(row.overall_grade, row.overall_rank),
    cleanPocket: statOrNull(row.clean_pocket_grade, row.clean_pocket_rank),
    pressure: statOrNull(row.pressure_grade, row.pressure_rank),
    bigTimeThrowPct: statOrNull(row.big_time_throw_pct, row.big_time_throw_rank),
    turnoverWorthyPct: statOrNull(row.turnover_worthy_pct, row.turnover_worthy_rank),
    avgTimeToThrow: statOrNull(row.avg_time_to_throw, row.avg_time_to_throw_rank),
    avgDepthOfTarget: statOrNull(row.avg_depth_of_target, row.avg_depth_of_target_rank),
  };
}

export async function getGameQbMatchup(
  season: number,
  homeTeam: string,
  awayTeam: string
): Promise<GameQbMatchup | null> {
  const rows = await query<QbMatchupRow>(
    `SELECT team, pff_player_id, player_name, espn_id, qualifying_qb_count,
            overall_grade, overall_rank, clean_pocket_grade, clean_pocket_rank,
            pressure_grade, pressure_rank, big_time_throw_pct, big_time_throw_rank,
            turnover_worthy_pct, turnover_worthy_rank, avg_time_to_throw, avg_time_to_throw_rank,
            avg_depth_of_target, avg_depth_of_target_rank
     FROM etl.pff_qb_matchup_stats
     WHERE season = $1 AND team IN ($2, $3)`,
    [season, homeTeam, awayTeam]
  );
  const home = rows.find((r) => r.team === homeTeam);
  const away = rows.find((r) => r.team === awayTeam);
  if (!home || !away) return null;
  return { home: rowToQbStat(home), away: rowToQbStat(away) };
}

// ----------------------------------------------------------------------
// Pressure Matchup
// ----------------------------------------------------------------------

export interface TeamPressure {
  pressureRateAllowed: StatWithRank | null;
  pressureRateGenerated: StatWithRank | null;
}

export interface GameTeamPressure {
  home: TeamPressure;
  away: TeamPressure;
}

interface TeamPressureRow {
  team: string;
  pressure_rate_allowed: number | null;
  pressure_rate_allowed_rank: number | null;
  pressure_rate_generated: number | null;
  pressure_rate_generated_rank: number | null;
}

export async function getGameTeamPressure(
  season: number,
  homeTeam: string,
  awayTeam: string
): Promise<GameTeamPressure | null> {
  const rows = await query<TeamPressureRow>(
    `SELECT team, pressure_rate_allowed, pressure_rate_allowed_rank,
            pressure_rate_generated, pressure_rate_generated_rank
     FROM etl.pff_team_pressure
     WHERE season = $1 AND team IN ($2, $3)`,
    [season, homeTeam, awayTeam]
  );
  const home = rows.find((r) => r.team === homeTeam);
  const away = rows.find((r) => r.team === awayTeam);
  if (!home || !away) return null;

  function toTeamPressure(row: TeamPressureRow): TeamPressure {
    return {
      pressureRateAllowed: statOrNull(row.pressure_rate_allowed, row.pressure_rate_allowed_rank),
      pressureRateGenerated: statOrNull(row.pressure_rate_generated, row.pressure_rate_generated_rank),
    };
  }

  return { home: toTeamPressure(home), away: toTeamPressure(away) };
}
