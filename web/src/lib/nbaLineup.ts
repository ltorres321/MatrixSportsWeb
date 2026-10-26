import "server-only";
import { query } from "@/lib/db";
import { etDateKey } from "@/lib/nbaSchedule";
import { toBrefAlias, normalizePlayerName, buildRosterCrosswalkByName } from "@/lib/nbaBrefCrosswalk";

// NBA equivalent of lineup.ts's PFF-depth-chart-based formation --
// the Matchups tab's full-court "who's actually on the floor" card.
// Same real-data sourcing as nbaStarterGrades.ts: nba.bbr_advanced
// (basketball-reference, already cron'd daily) has real games_started
// (who actually starts, no guessing) AND a real fine-grained position
// (PG/SG/SF/PF/C -- hoopR's own nba.rosters only has coarse G/F/C, so
// that table is used here ONLY for jersey number + ESPN photo id via
// nbaBrefCrosswalk.ts's name-matched lookup, same as Starter Grades).

export type CourtSlot = "PG" | "SG" | "SF" | "PF" | "C";

export interface LineupPlayer {
  playerId: string;
  name: string;
  // The player's own REAL position (bbr's pos column) -- shown on
  // their card as-is. Not necessarily equal to `slot` (see SLOT_ORDER's
  // own comment on why a real starting five doesn't always have one of
  // each position).
  position: string;
  slot: CourtSlot;
  jersey: string | null;
  per: number;
  espnId: string | null;
}

export interface TeamLineup {
  starters: LineupPlayer[]; // up to 5, already sorted into court-slot order
  secondTeam: LineupPlayer[]; // up to 5, the next tier by minutes played
}

export interface GameLineup {
  home: TeamLineup;
  away: TeamLineup;
}

interface LineupRow {
  player_id: string;
  name_display: string;
  team_name_abbr: string;
  pos: string | null;
  mp: string | number;
  games_started: number;
  per: string | number;
}

const SLOT_ORDER: CourtSlot[] = ["PG", "SG", "SF", "PF", "C"];
// Canonical rank used ONLY to sort a team's 5 real players into the 5
// fixed court slots -- not a requirement that a player's own position
// match the slot. A real starting five doesn't always have exactly
// one of each position (confirmed live: the Lakers currently start
// PG/SG/SG/SF/C, no true PF) -- ranking by this and dropping players
// into the 5 slots in order handles that gracefully, while each card
// still shows the player's own real position (see LineupPlayer.position),
// never a forced label.
const POSITION_RANK: Record<string, number> = { PG: 0, SG: 1, SF: 2, PF: 3, C: 4 };

function positionRank(pos: string | null): number {
  return pos !== null && pos in POSITION_RANK ? POSITION_RANK[pos] : 2.5; // unknown position sorts to the middle
}

const TOP_N = 5;

export async function getGameLineup(
  season: number,
  gameDate: Date,
  homeTeam: string,
  awayTeam: string
): Promise<GameLineup | null> {
  const brefHome = toBrefAlias(homeTeam);
  const brefAway = toBrefAlias(awayTeam);
  const asOfEtDate = etDateKey(gameDate);

  // Same as-of-date resolution as nbaStarterGrades.ts -- see that
  // file's own header for why a COALESCE handles both the current
  // season's daily snapshots and a completed season's single final
  // one with no branching.
  const [rows, rosterCrosswalk] = await Promise.all([
    query<LineupRow>(
      `WITH resolved AS (
         SELECT COALESCE(
           (SELECT MAX(snapshot_date) FROM nba.bbr_advanced WHERE season = $1 AND snapshot_date <= $2::date),
           (SELECT MIN(snapshot_date) FROM nba.bbr_advanced WHERE season = $1)
         ) AS snapshot_date
       )
       SELECT a.player_id, a.name_display, a.team_name_abbr, a.pos, a.mp, a.games_started, a.per
       FROM nba.bbr_advanced a
       CROSS JOIN resolved
       WHERE a.season = $1 AND a.snapshot_date = resolved.snapshot_date
         AND a.team_name_abbr IN ($3, $4)`,
      [season, asOfEtDate, brefHome, brefAway]
    ),
    buildRosterCrosswalkByName(),
  ]);
  if (rows.length === 0) return null;

  function toPlayers(teamRows: LineupRow[]): LineupPlayer[] {
    const withRank = teamRows.map((r) => {
      const crosswalk = rosterCrosswalk.get(normalizePlayerName(r.name_display));
      return {
        playerId: r.player_id,
        name: r.name_display,
        position: r.pos ?? "?",
        per: Number(r.per),
        jersey: crosswalk?.jersey ?? null,
        espnId: crosswalk?.espnId ?? null,
        rank: positionRank(r.pos),
      };
    });
    withRank.sort((a, b) => a.rank - b.rank);
    return withRank.map(
      (p, i): LineupPlayer => ({
        playerId: p.playerId,
        name: p.name,
        position: p.position,
        per: p.per,
        jersey: p.jersey,
        espnId: p.espnId,
        slot: SLOT_ORDER[i],
      })
    );
  }

  function build(brefAlias: string): TeamLineup {
    // Real starters first (most games started, ties broken by
    // minutes), then the next 5 by minutes played -- the "Second Team"
    // this app's own rotation actually plays, not a named bench-unit
    // concept real NBA data tracks explicitly.
    const teamRows = rows
      .filter((r) => r.team_name_abbr === brefAlias)
      .sort((a, b) => b.games_started - a.games_started || Number(b.mp) - Number(a.mp));

    return {
      starters: toPlayers(teamRows.slice(0, TOP_N)),
      secondTeam: toPlayers(teamRows.slice(TOP_N, TOP_N * 2)),
    };
  }

  return { home: build(brefHome), away: build(brefAway) };
}
