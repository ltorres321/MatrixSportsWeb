import "server-only";
import { query } from "@/lib/db";

// Real data layer over etl.pff_team_grades -- written by
// SportsPipelines/pff_api/poll_team_grades.py, which reads PFF's own
// Developer API (/v1/teams/overview) directly rather than
// reconstructing team grades from SportsAnalytics's own scraped-JSON
// pipeline (see that script's docstring for why the switch). See
// SportsPipelines/sql/005_pff_team_grades.sql and
// 006_pff_game_report.sql for the full writer-side contract. This
// file only ever SELECTs, same rule as every other lib here.
//
// "Current state" table: one row per (season, team), replaced
// wholesale whenever the export script reruns (weekly, alongside the
// Tuesday full-pipeline rebuild) -- there is no per-week history to
// query here, only "as of the last export."
export interface TeamPositionGrades {
  season: number;
  team: string;
  throughWeek: number;
  gamesIncluded: number;
  qb: number | null;
  rb: number | null;
  wr: number | null;
  ol: number | null;
  dline: number | null;
  secondary: number | null;
  runDefense: number | null;
  // Team-wide grades (sql/006_pff_game_report.sql) -- same
  // /v1/teams/overview response the 7 position-group grades above
  // already come from, just 4 more fields off it. Back the site's
  // "Team Grades" report section (getGameTeamGrades below).
  overall: number | null;
  offense: number | null;
  defense: number | null;
  specialTeams: number | null;
}

interface PffTeamGradesRow {
  season: number;
  team: string;
  through_week: number;
  games_included: number;
  qb_grade: number | null;
  rb_grade: number | null;
  wr_grade: number | null;
  ol_grade: number | null;
  dline_grade: number | null;
  secondary_grade: number | null;
  run_defense_grade: number | null;
  overall_grade: number | null;
  offense_grade: number | null;
  defense_grade: number | null;
  special_teams_grade: number | null;
}

const TEAM_GRADES_COLUMNS = `season, team, through_week, games_included, qb_grade, rb_grade, wr_grade,
            ol_grade, dline_grade, secondary_grade, run_defense_grade,
            overall_grade, offense_grade, defense_grade, special_teams_grade`;

function rowToGrades(row: PffTeamGradesRow): TeamPositionGrades {
  return {
    season: row.season,
    team: row.team,
    throughWeek: row.through_week,
    gamesIncluded: row.games_included,
    qb: row.qb_grade,
    rb: row.rb_grade,
    wr: row.wr_grade,
    ol: row.ol_grade,
    dline: row.dline_grade,
    secondary: row.secondary_grade,
    runDefense: row.run_defense_grade,
    overall: row.overall_grade,
    offense: row.offense_grade,
    defense: row.defense_grade,
    specialTeams: row.special_teams_grade,
  };
}

async function getTeamGrades(season: number, team: string): Promise<TeamPositionGrades | null> {
  const rows = await query<PffTeamGradesRow>(
    `SELECT ${TEAM_GRADES_COLUMNS}
     FROM etl.pff_team_grades
     WHERE season = $1 AND team = $2`,
    [season, team]
  );
  return rows.length > 0 ? rowToGrades(rows[0]) : null;
}

// The full league's current-season grades, for ranking one team's
// grade against the other 31 -- e.g. "5th of 32" next to a value.
// Small table (one row per team), fine to pull in full rather than
// adding a per-field COUNT/RANK query for each stat.
async function getLeagueGrades(season: number): Promise<TeamPositionGrades[]> {
  const rows = await query<PffTeamGradesRow>(
    `SELECT ${TEAM_GRADES_COLUMNS}
     FROM etl.pff_team_grades
     WHERE season = $1`,
    [season]
  );
  return rows.map(rowToGrades);
}

type GradeField = "qb" | "rb" | "wr" | "ol" | "dline" | "secondary" | "runDefense" | "overall" | "offense" | "defense" | "specialTeams";

// Standard competition ranking (ties share a rank, e.g. two teams
// tied for 2nd both show "2nd," next team is "4th") -- higher grade
// is always better, regardless of offense or defense field.
function buildRankLookup(league: TeamPositionGrades[], field: GradeField): { ranks: Map<string, number>; total: number } {
  const withGrade = league.filter((t) => t[field] !== null) as (TeamPositionGrades & Record<GradeField, number>)[];
  const sorted = [...withGrade].sort((a, b) => b[field] - a[field]);
  const ranks = new Map<string, number>();
  sorted.forEach((t, i) => {
    const rank = i === 0 || t[field] !== sorted[i - 1][field] ? i + 1 : ranks.get(sorted[i - 1].team)!;
    ranks.set(t.team, rank);
  });
  return { ranks, total: withGrade.length };
}

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export interface EdgeSide {
  alias: string;
  grade: number;
  rankLabel: string; // e.g. "5th of 32"
  // Raw ordinal, same one rankLabel is built from -- exposed
  // separately so the UI can style a top-5 (or any other threshold)
  // rank without parsing it back out of the formatted string. Safe to
  // compare directly against a fixed threshold here specifically
  // since Team Grades always ranks against the full, fixed 32-team
  // league, never an ambiguous qualifying pool.
  rank: number | null;
}

export interface TeamGradeRow {
  label: string;
  home: EdgeSide;
  away: EdgeSide;
}

// PFF's own "Team Grades" report section -- both teams' OWN grades
// side by side (home vs away), a different comparison shape from
// "Who Has the Edge?" above (which is deliberately cross-unit: this
// team's offense against THAT team's defense). Same underlying table
// and same rank-lookup mechanics, just paired differently, so this
// stays in this file rather than duplicating the read layer elsewhere.
export async function getGameTeamGrades(
  season: number,
  homeTeam: string,
  awayTeam: string
): Promise<TeamGradeRow[] | null> {
  const [homeGrades, awayGrades, league] = await Promise.all([
    getTeamGrades(season, homeTeam),
    getTeamGrades(season, awayTeam),
    getLeagueGrades(season),
  ]);
  if (!homeGrades || !awayGrades) return null;
  const home = homeGrades;
  const away = awayGrades;

  const rankLookups = new Map<GradeField, { ranks: Map<string, number>; total: number }>();
  function rankLookupFor(field: GradeField) {
    let lookup = rankLookups.get(field);
    if (!lookup) {
      lookup = buildRankLookup(league, field);
      rankLookups.set(field, lookup);
    }
    return lookup;
  }

  function side(team: TeamPositionGrades, field: GradeField, grade: number): EdgeSide {
    const { ranks, total } = rankLookupFor(field);
    const rank = ranks.get(team.team);
    return { alias: team.team, grade, rankLabel: rank ? `${ordinal(rank)} of ${total}` : `of ${total}`, rank: rank ?? null };
  }

  function row(label: string, field: GradeField): TeamGradeRow | null {
    const homeGrade = home[field];
    const awayGrade = away[field];
    if (homeGrade === null || awayGrade === null) return null;
    return { label, home: side(home, field, homeGrade), away: side(away, field, awayGrade) };
  }

  const rows = [
    row("Overall", "overall"),
    row("Offense", "offense"),
    row("Defense", "defense"),
    row("Special Teams", "specialTeams"),
    row("Passing Offense", "qb"),
    row("Rushing Offense", "rb"),
    row("Receiving", "wr"),
    row("Offensive Line", "ol"),
    row("Pass Rush", "dline"),
    row("Coverage", "secondary"),
    row("Run Defense", "runDefense"),
  ].filter((r): r is TeamGradeRow => r !== null);

  return rows.length > 0 ? rows : null;
}
