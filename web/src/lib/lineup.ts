import "server-only";
import { cache } from "react";
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
  // Non-null only when this player is NOT on the team's active roster
  // (IR, traded, cut...) but is still shown because the depth chart has
  // nobody else at his slot -- see getGameLineup.
  rosterNote: string | null;
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
  depth_order: number;
}

interface RosterRow {
  week: number;
  team: string;
  status: string | null;
  status_code: string | null;
  pff_id: string | null;
  player_lower: string;
}

function rosterNoteFor(current: RosterRow | undefined): string {
  if (!current) return "Off roster";
  if (current.status === "RES") return current.status_code === "R01" ? "IR" : "Reserve";
  if (current.status === "INA") return "Inactive";
  if (current.status === "DEV") return "Practice squad";
  return "Off roster";
}

function rowToPlayer(row: LineupRow, rosterNote: string | null = null): LineupPlayer {
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
    rosterNote,
  };
}

// The PFF depth chart behind this (etl.pff_lineup) is refreshed only
// occasionally (that API's yearly call budget), so on its own it keeps
// showing a "starter" for weeks after he went on IR or left the team
// -- confirmed live 2026-11-15: Malik Willis (MIA, on IR) and Kirk
// Cousins (LV on the chart, actually on MIN's roster). So every chart
// player is cross-checked against etl.roster_status (nflverse's weekly
// roster file, SportsPipelines' poll_roster_status.py), using each
// team's most recent roster week at or before the game's week:
//   - a starter who isn't on this team's active roster is dropped and
//     the next available player at the same alignment slot is shown;
//   - if the chart has nobody else at that slot, he stays, tagged with
//     rosterNote ("IR", "Off roster"...) rather than leaving a hole;
//   - a player the roster file doesn't know at all (no PFF id or name
//     match), or a team with no roster data yet, is left exactly as the
//     chart has it -- never dropped on missing data.
// "Inactive" (a game-day scratch) only counts against a player for the
// very week it was recorded, not for a later game.
// Wrapped in React's cache(): the game page asks for this twice per
// request (the Matchups tab and the QB card's starter check), and the
// site's Postgres pool is a single connection, so the repeat would
// otherwise re-run all three queries back to back.
export const getGameLineup = cache(async function getGameLineup(
  season: number,
  week: number,
  homeTeam: string,
  awayTeam: string
): Promise<GameLineup | null> {
  const chart = await query<LineupRow>(
    `SELECT team, unit, position, alignment, pff_player_id, player_name, jersey,
            grade, grade_rank, grade_rank_of, espn_id, depth_order
     FROM etl.pff_lineup
     WHERE season = $1 AND team IN ($2, $3)
     ORDER BY team, unit, position, alignment, depth_order`,
    [season, homeTeam, awayTeam]
  );
  if (chart.length === 0) return null;

  let roster: RosterRow[] = [];
  const latestWeek = new Map<string, number>();
  try {
    // One query, not two: each team's latest roster week is read off the
    // same rows (some chart player is always on his team's roster that
    // week), which matters because the site's pool is one connection.
    roster = await query<RosterRow>(
      `SELECT week, team, status, status_code, pff_id, lower(player) AS player_lower
       FROM etl.roster_status
       WHERE season = $1 AND week <= $2
         AND (pff_id = ANY($3::text[]) OR lower(player) = ANY($4::text[]))`,
      [season, week, chart.map((r) => String(r.pff_player_id)), chart.map((r) => r.player_name.toLowerCase())]
    );
    for (const r of roster) {
      if (r.team !== homeTeam && r.team !== awayTeam) continue;
      if (r.week > (latestWeek.get(r.team) ?? -1)) latestWeek.set(r.team, r.week);
    }
  } catch (err) {
    // Fall back to the raw depth chart rather than losing the whole tab.
    console.error("roster_status lookup failed", err);
  }

  // null = available (or unknown); a string = why he isn't.
  function unavailableNote(row: LineupRow): string | null {
    const teamWeek = latestWeek.get(row.team);
    if (teamWeek === undefined) return null;
    const byId = roster.filter((r) => r.pff_id === String(row.pff_player_id));
    const matches = byId.length > 0 ? byId : roster.filter((r) => r.player_lower === row.player_name.toLowerCase());
    if (matches.length === 0) return null;
    const current = matches.find((r) => r.team === row.team && r.week === teamWeek);
    if (current?.status === "ACT") return null;
    if (current?.status === "INA" && current.week < week) return null;
    return rosterNoteFor(current);
  }

  const slots = new Map<string, LineupRow[]>();
  for (const row of chart) {
    const key = `${row.team}|${row.unit}|${row.alignment}`;
    const slot = slots.get(key);
    if (slot) slot.push(row);
    else slots.set(key, [row]);
  }

  const shown: { row: LineupRow; note: string | null }[] = [];
  for (const slot of slots.values()) {
    const starters = slot.filter((r) => r.depth_order === 1);
    if (starters.length === 0) continue; // the chart never had a starter here
    const availableStarters = starters.filter((r) => unavailableNote(r) === null);
    if (availableStarters.length > 0) {
      for (const row of availableStarters) shown.push({ row, note: null });
      continue;
    }
    const backups = slot.filter((r) => unavailableNote(r) === null);
    if (backups.length > 0) {
      const nextDepth = Math.min(...backups.map((r) => r.depth_order));
      for (const row of backups.filter((r) => r.depth_order === nextDepth)) shown.push({ row, note: null });
      continue;
    }
    for (const row of starters) shown.push({ row, note: unavailableNote(row) });
  }

  function build(team: string): TeamLineup {
    const forUnit = (unit: string) =>
      shown.filter((s) => s.row.team === team && s.row.unit === unit).map((s) => rowToPlayer(s.row, s.note));
    return { offense: forUnit("offense"), defense: forUnit("defense") };
  }

  const home = build(homeTeam);
  const away = build(awayTeam);
  const isEmpty = (t: TeamLineup) => t.offense.length === 0 && t.defense.length === 0;
  if (isEmpty(home) && isEmpty(away)) return null;
  return { home, away };
});
