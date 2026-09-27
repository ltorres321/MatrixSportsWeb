import "server-only";
import { query } from "@/lib/db";

// Real data layer over etl.injury_reports -- written by
// SportsPipelines' nflverse_injuries/poll_injuries.py (3x/day during
// the season straight from nflverse's official injury report release).
// This file only ever SELECTs. See that table's own SQL comment
// (SportsPipelines/sql/002_injury_reports.sql) for why every
// report_status tier (including blank) is kept there -- filtering
// down to what's actually worth showing is this file's job.
//
// report_status is nflverse's OFFICIAL Wed/Thu/Fri-combined
// designation (Out/Doubtful/Questionable) but is frequently still
// NULL/blank mid-week, before that designation has been assigned for
// the upcoming game -- especially for a short week (Thursday Night
// Football only gets one practice day). When it's blank, the row's
// practice_status (a real, already-reported fact -- "did this player
// practice today") is the only real signal available yet, so it's
// shown as a softer fallback label instead of hiding the player
// entirely.
export interface InjuryEntry {
  player: string;
  position: string | null;
  status: string; // display label -- see statusLabel() below
  isOfficial: boolean; // true = a real Out/Doubtful/Questionable designation; false = practice-status fallback
  injury: string | null;
}

export interface GameInjuryReport {
  home: InjuryEntry[];
  away: InjuryEntry[];
}

interface InjuryRow {
  team: string;
  player: string;
  position: string | null;
  report_status: string | null;
  report_primary_injury: string | null;
  practice_status: string | null;
  practice_primary_injury: string | null;
}

// A real slice of nflverse's "Out"/"Doubtful" rows aren't injuries at
// all (a rest day, a personal matter) -- same gotcha this project
// already found and works around in SportsLLM's performanceFacts.ts.
// Filtered here too, otherwise a healthy veteran's scheduled day off
// shows up looking like an injury scare.
const NON_INJURY_PATTERN = /not injury related/i;

function practiceStatusLabel(practiceStatus: string | null): string | null {
  if (!practiceStatus) return null;
  if (/did not participate/i.test(practiceStatus)) return "DNP";
  if (/limited/i.test(practiceStatus)) return "Limited";
  if (/full participation/i.test(practiceStatus)) return "Full";
  return practiceStatus;
}

function rowToEntry(row: InjuryRow): InjuryEntry | null {
  const injury = row.report_primary_injury ?? row.practice_primary_injury ?? null;
  if (injury && NON_INJURY_PATTERN.test(injury)) return null;

  if (row.report_status && row.report_status.trim() !== "") {
    return {
      player: row.player,
      position: row.position,
      status: row.report_status,
      isOfficial: true,
      injury,
    };
  }

  const practiceLabel = practiceStatusLabel(row.practice_status);
  if (!practiceLabel) return null;
  return {
    player: row.player,
    position: row.position,
    status: practiceLabel,
    isOfficial: false,
    injury,
  };
}

// QBs first (this project's own model already tested injury data as
// a predictive feature and found it null -- see modeling-decisions.md
// -- so this is pure context for readers, but a starting QB's status
// is the one injury-report line most readers actually care about),
// then by how serious the designation reads.
const STATUS_RANK: Record<string, number> = {
  Out: 0,
  Doubtful: 1,
  Questionable: 2,
  DNP: 3,
  Limited: 4,
  Full: 5,
};

function sortEntries(entries: InjuryEntry[]): InjuryEntry[] {
  return [...entries].sort((a, b) => {
    const aIsQb = a.position === "QB" ? 0 : 1;
    const bIsQb = b.position === "QB" ? 0 : 1;
    if (aIsQb !== bIsQb) return aIsQb - bIsQb;
    const aRank = STATUS_RANK[a.status] ?? 6;
    const bRank = STATUS_RANK[b.status] ?? 6;
    if (aRank !== bRank) return aRank - bRank;
    return a.player.localeCompare(b.player);
  });
}

export async function getGameInjuryReport(
  season: number,
  week: number,
  homeTeam: string,
  awayTeam: string
): Promise<GameInjuryReport | null> {
  const rows = await query<InjuryRow>(
    `SELECT team, player, position, report_status, report_primary_injury, practice_status, practice_primary_injury
     FROM etl.injury_reports
     WHERE season = $1 AND week = $2 AND team IN ($3, $4)`,
    [season, week, homeTeam, awayTeam]
  );
  if (rows.length === 0) return null;

  const home: InjuryEntry[] = [];
  const away: InjuryEntry[] = [];
  for (const row of rows) {
    const entry = rowToEntry(row);
    if (!entry) continue;
    if (row.team === homeTeam) home.push(entry);
    else if (row.team === awayTeam) away.push(entry);
  }

  if (home.length === 0 && away.length === 0) return null;
  return { home: sortEntries(home), away: sortEntries(away) };
}
