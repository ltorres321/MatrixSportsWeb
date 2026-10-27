import "server-only";
import { query } from "@/lib/db";
import { etDateKey } from "@/lib/nbaSchedule";
import { toBrefAlias, normalizePlayerName, buildRosterCrosswalkByName } from "@/lib/nbaBrefCrosswalk";

// NBA equivalent of pffGameReport.ts's "Highest Graded Players"
// section ("Starter Grades" here) -- same shape as every other data
// source in this app: a plain SELECT against Postgres, NOT a
// filesystem read. SportsAnalytics' basketball-reference scrape
// (SportsPipelines/SportsReference/nba/scraper/run_collect_league_
// leaders.py, cron'd daily at 7:35am ET -- see SportsPipelines'
// CRON_SCHEDULE.md) upserts into nba.bbr_advanced/nba.bbr_per_game
// (sql/021_bbr_league_leaders.sql) in the SAME database this app's
// DATABASE_URL already points at, exactly like PFF's own poller
// writes to etl.pff_player_grades. An earlier version of this file
// read SportsAnalytics' CSVs straight off local disk, which only
// works in local dev -- this app deploys to Netlify (see
// netlify.toml), whose serverless functions have no access to this
// machine's filesystem, so that approach came back empty in
// production. Querying Postgres instead fixes that, the same way
// every other section on this page already works. toBrefAlias/
// normalizePlayerName/buildRosterCrosswalkByName now live in
// nbaBrefCrosswalk.ts, shared with nbaLineup.ts.

export interface StarterGradePlayer {
  playerId: string;
  name: string;
  position: string | null;
  games: number;
  gamesStarted: number;
  pts: number;
  per: number;
  wsPer48: number;
  // ESPN's own numeric athlete id, when a real-photo lookup found one
  // -- see nbaBrefCrosswalk.ts's buildRosterCrosswalkByName for where
  // this comes from and why it's name-matched rather than a real
  // player-id join. null means "no match," not "no photo exists" --
  // PlayerHeadshot-style components should fall back to a team logo,
  // same as the NFL page.
  espnId: string | null;
}

export interface TeamStarterGrades {
  byPts: StarterGradePlayer[];
  byPer: StarterGradePlayer[];
  byWs48: StarterGradePlayer[];
}

export interface GameStarterGrades {
  home: TeamStarterGrades;
  away: TeamStarterGrades;
}

interface StarterGradeRow {
  player_id: string;
  name_display: string;
  team_name_abbr: string;
  pos: string | null;
  games: number;
  games_started: number;
  per: string | number;
  ws_per_48: string | number;
  pts_per_g: string | number;
}

const TOP_N = 5;
// Same spirit as pffGameReport's "minimum 25% of that side's snaps"
// floor on the NFL Highest Graded Players card -- here, a player must
// have started at least a quarter of their team's games played so far
// to count as a "starter," independent of which of the 3 stats is
// currently sorted on.
const MIN_START_SHARE = 0.25;

export async function getGameStarterGrades(
  season: number,
  gameDate: Date,
  homeTeam: string,
  awayTeam: string
): Promise<GameStarterGrades | null> {
  const brefHome = toBrefAlias(homeTeam);
  const brefAway = toBrefAlias(awayTeam);

  // Which snapshot_date to read depends on how old this game is, NOT
  // just "whatever's newest" -- a game played days ago must keep
  // showing the stats as they stood ON that day (or the closest
  // snapshot before it), even after later snapshots push those
  // players' season averages up or down. Two cases, resolved by one
  // COALESCE rather than branching on "is this the current season":
  //   1. The current season (2027) gets a new dated snapshot every
  //      day the cron job runs -- pick the latest snapshot_date that
  //      is <= this game's own ET calendar date.
  //   2. A completed season (2025/2026) has exactly ONE snapshot,
  //      dated '<season>-06-30' (collect_season's --final path) --
  //      every regular/postseason game date falls before that, so
  //      case 1 finds nothing and this falls back to MIN(snapshot_date),
  //      which is that single final row. Exactly the "use the last day
  //      of season for historical games" rule asked for.
  // nba.bbr_advanced/nba.bbr_per_game never overwrite an old
  // snapshot_date row (grain is (season, snapshot_date, player_id,
  // team) -- sql/021_bbr_league_leaders.sql), so this as-of lookup
  // works for as long as that history is kept.
  const asOfEtDate = etDateKey(gameDate);
  const [rows, rosterCrosswalk] = await Promise.all([
    query<StarterGradeRow>(
      `WITH resolved AS (
         SELECT COALESCE(
           (SELECT MAX(snapshot_date) FROM nba.bbr_advanced WHERE season = $1 AND snapshot_date <= $2::date),
           (SELECT MIN(snapshot_date) FROM nba.bbr_advanced WHERE season = $1)
         ) AS snapshot_date
       )
       SELECT a.player_id, a.name_display, a.team_name_abbr, a.pos, a.games, a.games_started,
              a.per, a.ws_per_48, p.pts_per_g
       FROM nba.bbr_advanced a
       JOIN nba.bbr_per_game p
         ON p.season = a.season AND p.snapshot_date = a.snapshot_date
        AND p.player_id = a.player_id AND p.team_name_abbr = a.team_name_abbr
       CROSS JOIN resolved
       WHERE a.season = $1 AND a.snapshot_date = resolved.snapshot_date
         AND a.team_name_abbr IN ($3, $4)`,
      [season, asOfEtDate, brefHome, brefAway]
    ),
    buildRosterCrosswalkByName(),
  ]);
  if (rows.length === 0) return null;

  function build(brefAlias: string): TeamStarterGrades {
    const players: StarterGradePlayer[] = rows
      .filter((r) => r.team_name_abbr === brefAlias)
      .filter((r) => r.games > 0 && r.games_started / r.games >= MIN_START_SHARE)
      .map((r) => ({
        playerId: r.player_id,
        name: r.name_display,
        position: r.pos,
        games: r.games,
        gamesStarted: r.games_started,
        pts: Number(r.pts_per_g),
        per: Number(r.per),
        wsPer48: Number(r.ws_per_48),
        espnId: rosterCrosswalk.get(normalizePlayerName(r.name_display))?.espnId ?? null,
      }));

    const topBy = (key: "pts" | "per" | "wsPer48") =>
      [...players].sort((a, b) => b[key] - a[key]).slice(0, TOP_N);

    return { byPts: topBy("pts"), byPer: topBy("per"), byWs48: topBy("wsPer48") };
  }

  return { home: build(brefHome), away: build(brefAway) };
}
