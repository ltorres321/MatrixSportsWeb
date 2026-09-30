import "server-only";
import { query } from "@/lib/db";

// Read layer over etl.pff_lineup, added by
// SportsPipelines/sql/009_pff_lineup.sql and written by
// SportsPipelines/pff_api/poll_lineup.py -- backs the site's
// "Matchups" tab (PFF's own site calls the equivalent tab "Lineup"): a
// formation-style view of both teams' real starters, with PFF grade
// and that grade's league-wide rank for their SPECIFIC alignment slot
// (e.g. "8th of 69" among left tackles). Same "server-only, plain
// SELECT, typed row mapper" convention as pffGameReport.ts/pffGrades.ts.
//
// Filtered to depth_order = 1 at the SQL level (the formation diagram
// only ever shows starters) -- easy to loosen later (just drop the
// clause) since the underlying table keeps every rostered player's
// full depth chart regardless of what this query asks for.

export interface LineupPlayer {
  pffPlayerId: number;
  playerName: string;
  jersey: string | null;
  position: string;
  alignment: string;
  grade: number | null;
  gradeRank: number | null;
  gradeRankOf: number | null;
  espnId: string | null;
}

export interface TeamLineup {
  offense: LineupPlayer[];
  defense: LineupPlayer[];
}

export interface GameLineup {
  home: TeamLineup;
  away: TeamLineup;
}

interface LineupRow {
  team: string;
  unit: string;
  position: string;
  alignment: string;
  pff_player_id: number;
  player_name: string;
  jersey: string | null;
  grade: number | null;
  grade_rank: number | null;
  grade_rank_of: number | null;
  espn_id: string | null;
}

function rowToPlayer(row: LineupRow): LineupPlayer {
  return {
    pffPlayerId: row.pff_player_id,
    playerName: row.player_name,
    jersey: row.jersey,
    position: row.position,
    alignment: row.alignment,
    grade: row.grade,
    gradeRank: row.grade_rank,
    gradeRankOf: row.grade_rank_of,
    espnId: row.espn_id,
  };
}

export async function getGameLineup(
  season: number,
  homeTeam: string,
  awayTeam: string
): Promise<GameLineup | null> {
  const rows = await query<LineupRow>(
    `SELECT team, unit, position, alignment, pff_player_id, player_name, jersey,
            grade, grade_rank, grade_rank_of, espn_id
     FROM etl.pff_lineup
     WHERE season = $1 AND team IN ($2, $3) AND depth_order = 1
     ORDER BY team, unit, position, alignment`,
    [season, homeTeam, awayTeam]
  );
  if (rows.length === 0) return null;

  function build(team: string): TeamLineup {
    return {
      offense: rows.filter((r) => r.team === team && r.unit === "offense").map(rowToPlayer),
      defense: rows.filter((r) => r.team === team && r.unit === "defense").map(rowToPlayer),
    };
  }

  const home = build(homeTeam);
  const away = build(awayTeam);
  const isEmpty = (t: TeamLineup) => t.offense.length === 0 && t.defense.length === 0;
  if (isEmpty(home) && isEmpty(away)) return null;
  return { home, away };
}
