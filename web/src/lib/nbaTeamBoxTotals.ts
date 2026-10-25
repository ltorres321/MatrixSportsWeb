import "server-only";
import { query } from "@/lib/db";
import { etDateKey } from "@/lib/nbaSchedule";

// Shared data layer under nbaTeamGrades.ts (Team Grades) AND
// nbaEfficiencyScoring.ts (Offense/Defense card) -- both sections are
// built from the exact same per-team, as-of-date SUM of hoopR's real
// box scores (nba.team_box_scores/nba.games), self-joined to each
// game's opponent row for the "allowed"/opponent side. Factored out
// here rather than duplicated so the query, the Dean Oliver
// possession estimate, and the tie-aware league-ranking algorithm
// only exist once. See nbaTeamGrades.ts's own header for why this can
// read "as of a game's date" with no snapshot-staleness logic at all
// (team_box_scores rows are real completed-game facts that never
// change once written) and why this is scoped to season_type = 2
// (regular season) only.

export interface TeamBoxTotals {
  alias: string;
  gamesPlayed: number;
  // Per-GAME averages (season totals / games), own team.
  pts: number;
  reb: number;
  ast: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  orb: number;
  drb: number;
  stl: number;
  blk: number;
  tov: number;
  pf: number;
  // Per-GAME averages of the OPPONENT's box score across this team's
  // own games -- what this team allowed/faced.
  oppPts: number;
  oppFgm: number;
  oppFga: number;
  oppFg3m: number;
  oppFg3a: number;
  oppFtm: number;
  oppFta: number;
  oppOrb: number;
  oppDrb: number;
  oppAst: number;
  oppStl: number;
  oppBlk: number;
  oppTov: number;
  oppPf: number;
  // Dean Oliver's estimated possessions per game, averaged across both
  // teams' own sides of the same games -- see nbaTeamGrades.ts's
  // original header for the exact formula/rationale (team_box_scores
  // has no minutes-per-game column, so this isn't normalized to a
  // strict 48-minute game).
  poss: number;
}

interface TeamBoxTotalsRow {
  team_abbreviation: string;
  games: string;
  pts: string; reb: string; ast: string;
  fgm: string; fga: string; fg3m: string; fg3a: string; ftm: string; fta: string;
  orb: string; drb: string; stl: string; blk: string; tov: string; pf: string;
  opp_pts: string;
  opp_fgm: string; opp_fga: string; opp_fg3m: string; opp_fg3a: string; opp_ftm: string; opp_fta: string;
  opp_orb: string; opp_drb: string; opp_ast: string; opp_stl: string; opp_blk: string; opp_tov: string; opp_pf: string;
}

export async function getLeagueTeamBoxTotals(season: number, gameDate: Date): Promise<TeamBoxTotals[]> {
  const rows = await query<TeamBoxTotalsRow>(
    `SELECT t.team_abbreviation,
            count(*) AS games,
            sum(t.team_score) AS pts, sum(t.total_rebounds) AS reb, sum(t.assists) AS ast,
            sum(t.field_goals_made) AS fgm, sum(t.field_goals_attempted) AS fga,
            sum(t.three_point_field_goals_made) AS fg3m, sum(t.three_point_field_goals_attempted) AS fg3a,
            sum(t.free_throws_made) AS ftm, sum(t.free_throws_attempted) AS fta,
            sum(t.offensive_rebounds) AS orb, sum(t.defensive_rebounds) AS drb,
            sum(t.steals) AS stl, sum(t.blocks) AS blk, sum(t.turnovers) AS tov, sum(t.fouls) AS pf,
            sum(o.team_score) AS opp_pts,
            sum(o.field_goals_made) AS opp_fgm, sum(o.field_goals_attempted) AS opp_fga,
            sum(o.three_point_field_goals_made) AS opp_fg3m, sum(o.three_point_field_goals_attempted) AS opp_fg3a,
            sum(o.free_throws_made) AS opp_ftm, sum(o.free_throws_attempted) AS opp_fta,
            sum(o.offensive_rebounds) AS opp_orb, sum(o.defensive_rebounds) AS opp_drb,
            sum(o.assists) AS opp_ast, sum(o.steals) AS opp_stl, sum(o.blocks) AS opp_blk,
            sum(o.turnovers) AS opp_tov, sum(o.fouls) AS opp_pf
     FROM nba.team_box_scores t
     JOIN nba.team_box_scores o ON o.game_id = t.game_id AND o.team_abbreviation = t.opponent_team_abbreviation
     JOIN nba.games g ON g.game_id = t.game_id
     WHERE g.season = $1 AND g.season_type = 2 AND g.game_date <= $2::date
     GROUP BY t.team_abbreviation`,
    [season, etDateKey(gameDate)]
  );

  return rows
    .map((row): TeamBoxTotals => {
      const games = Number(row.games);
      const pg = (total: string) => Number(total) / games;

      const fga = pg(row.fga), fgm = pg(row.fgm), fta = pg(row.fta), orb = pg(row.orb), drb = pg(row.drb), tov = pg(row.tov);
      const oppFga = pg(row.opp_fga), oppFgm = pg(row.opp_fgm), oppFta = pg(row.opp_fta);
      const oppOrb = pg(row.opp_orb), oppDrb = pg(row.opp_drb), oppTov = pg(row.opp_tov);

      // Dean Oliver's possession estimate -- see this file's header.
      const poss =
        0.5 *
        (fga + 0.4 * fta - 1.07 * (orb / (orb + oppDrb)) * (fga - fgm) + tov +
          (oppFga + 0.4 * oppFta - 1.07 * (oppOrb / (oppOrb + drb)) * (oppFga - oppFgm) + oppTov));

      return {
        alias: row.team_abbreviation,
        gamesPlayed: games,
        pts: pg(row.pts), reb: pg(row.reb), ast: pg(row.ast),
        fgm, fga, fg3m: pg(row.fg3m), fg3a: pg(row.fg3a), ftm: pg(row.ftm), fta,
        orb, drb, stl: pg(row.stl), blk: pg(row.blk), tov, pf: pg(row.pf),
        oppPts: pg(row.opp_pts),
        oppFgm, oppFga, oppFg3m: pg(row.opp_fg3m), oppFg3a: pg(row.opp_fg3a), oppFtm: pg(row.opp_ftm), oppFta,
        oppOrb, oppDrb, oppAst: pg(row.opp_ast), oppStl: pg(row.opp_stl), oppBlk: pg(row.opp_blk),
        oppTov, oppPf: pg(row.opp_pf),
        poss,
      };
    })
    .filter((t) => t.gamesPlayed > 0);
}

export interface StatWithRank {
  value: number;
  rank: number; // 1 = best, direction-aware (see each caller's own lowerIsBetter set)
  // true when at least one other team has this exact same value for
  // this stat -- common this early in a season when whole-number box
  // score sums divide out identically (confirmed live: 3 teams tied
  // at exactly 40.0 rebounds/game after 2-3 games each).
  tied: boolean;
}

// Standard competition ranking ("1224," the same convention a golf
// leaderboard uses): a tied group all share the rank of the first
// team in that group, and the next distinct value picks up after the
// whole group rather than the next integer. Pulled out of
// nbaTeamGrades.ts's original rankLeague() so nbaEfficiencyScoring.ts
// doesn't have to re-implement (and risk re-diverging from) the exact
// same tie-handling fix.
export function rankWithTies<T extends { alias: string }>(
  teams: T[],
  getValue: (team: T) => number,
  lowerIsBetter: boolean
): Map<string, StatWithRank> {
  const sorted = [...teams].sort((a, b) => (lowerIsBetter ? getValue(a) - getValue(b) : getValue(b) - getValue(a)));
  const result = new Map<string, StatWithRank>();
  const tieCounts = new Map<number, number>();
  sorted.forEach((team, i) => {
    const rank = i > 0 && getValue(sorted[i]) === getValue(sorted[i - 1]) ? result.get(sorted[i - 1].alias)!.rank : i + 1;
    result.set(team.alias, { value: getValue(team), rank, tied: false });
    tieCounts.set(rank, (tieCounts.get(rank) ?? 0) + 1);
  });
  for (const stat of result.values()) {
    stat.tied = tieCounts.get(stat.rank)! > 1;
  }
  return result;
}
