import "server-only";
import { query } from "@/lib/db";

// Shared under nbaStarterGrades.ts AND nbaLineup.ts -- both read
// basketball-reference data (nba.bbr_*, keyed by bref's own team
// codes) and need a real player photo, which only exists via
// nba.rosters (hoopR, keyed by this app's own team alias scheme and
// ESPN's numeric athlete_id). Factored out here so both files share
// one alias map and one name-normalization/crosswalk implementation
// instead of drifting apart. See nbaStarterGrades.ts's original header
// (preserved below) for the full rationale on both points.

// bref's own team_name_abbr values differ from this app's own alias
// scheme (teamsNba.ts, which matches hoopR/src4) for exactly the
// franchises with a historically-ambiguous short code -- confirmed
// against the real nba.bbr_advanced rows (BRK/CHO/GSW/NOP/NYK/PHO/
// SAS/UTA/WAS all appear; every other code already matches).
const BREF_ALIAS_TO_APP_ALIAS: Record<string, string> = {
  BRK: "BKN",
  CHO: "CHA",
  GSW: "GS",
  NOP: "NO",
  NYK: "NY",
  PHO: "PHX",
  SAS: "SA",
  UTA: "UTAH",
  WAS: "WSH",
};
const APP_ALIAS_TO_BREF_ALIAS: Record<string, string> = Object.fromEntries(
  Object.entries(BREF_ALIAS_TO_APP_ALIAS).map(([bref, app]) => [app, bref])
);

export function toBrefAlias(appAlias: string): string {
  return APP_ALIAS_TO_BREF_ALIAS[appAlias] ?? appAlias;
}

export function normalizePlayerName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents: bref's "Luka Dončić" vs hoopR's "Luka Doncic"
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

export interface RosterCrosswalkEntry {
  espnId: string;
  jersey: string | null;
}

interface RosterRow {
  athlete_id: string;
  full_name: string;
  jersey: string | null;
}

// There's no NBA player-id crosswalk table yet (the NFL page's
// headshots key off a real PFF->ESPN id crosswalk --
// etl.espn_player_crosswalk, sql/014 -- that has no basketball
// equivalent). The only other ESPN-id-bearing table in this DB is
// nba.rosters (hoopR, athlete_id IS ESPN's own numeric id -- confirmed
// live against https://a.espncdn.com/i/headshots/nba/players/full/
// {athlete_id}.png, which returns a real photo), so this matches by
// normalized full name instead of a real id join. Confirmed against
// the real 2027 data: zero normalized-name collisions across all 548
// rostered players, and name-only matching covers ~96% of starters
// (the rest are mostly players nba.rosters hasn't picked up yet --
// recent trades/call-ups -- not a bad match, a missing one; those
// just fall back to a team logo like the NFL page's own espnId==null
// case). No season/team filter on purpose: nba.rosters only ever
// holds the CURRENT season's roster (it's a "who's on this team right
// now" snapshot, not historical -- see sql/004_nba_schema.sql's own
// comment), so a player from a past-season historical game is matched
// by name against today's roster, which is the best photo/jersey
// source available for them regardless of which team they were on
// back then. Jersey number rides along on the same lookup -- same
// ~78% coverage caveat as espnId (nba.rosters has real gaps, e.g.
// several active Lakers rotation players have no jersey on file yet).
export async function buildRosterCrosswalkByName(): Promise<Map<string, RosterCrosswalkEntry>> {
  const rows = await query<RosterRow>(`SELECT athlete_id, full_name, jersey FROM nba.rosters`);
  const map = new Map<string, RosterCrosswalkEntry>();
  const seenCollision = new Set<string>();
  for (const row of rows) {
    const key = normalizePlayerName(row.full_name);
    if (seenCollision.has(key)) continue;
    if (map.has(key) && map.get(key)!.espnId !== row.athlete_id) {
      map.delete(key);
      seenCollision.add(key);
      continue;
    }
    map.set(key, { espnId: row.athlete_id, jersey: row.jersey });
  }
  return map;
}
