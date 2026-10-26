import "server-only";
import sharp from "sharp";
import path from "node:path";
import { query } from "@/lib/db";
import { etDateKey } from "@/lib/nbaSchedule";
import { toBrefAlias } from "@/lib/nbaBrefCrosswalk";

// Shot chart data -- real per-shot makes/misses from
// basketball-reference (nba.bbr_shot_chart, sql/022_bbr_shot_chart.sql
// in SportsPipelines, loaded by the new poll_shot_chart_db.py --
// that table didn't exist before this feature; the raw per-game JSON
// files it reads were already being scraped daily by
// run_collect_shotchart.py, just never loaded into Postgres). Each
// shot is bucketed into one of 9 court zones by checking its real
// (top_px, left_px) position (literal CSS pixel offsets within
// basketball-reference's own shot-chart image -- that image IS
// court-nba-bbr.svg, the same file this project's own court art comes
// from, rendered at width:500px) against 9 pixel masks derived from
// the user's own zone-numbered court asset
// (public/assets/court/Fullcourt-nba-bbr_SectionsBlueNum2.png,
// segmented via flood fill + a centroid-sampling pass per zone
// digit, with the free-throw circle's and half-court circle's own
// decorative black lines -- not real zone walls -- reconnected into
// zones 7 and 9 respectively after the flood fill split them; see
// this feature's own build notes). Classification is the SAME for
// every team regardless of home/away -- bref records every team's own
// shot chart in one fixed, standard half-court orientation (baseline
// at the top). The home-team-is-flipped-180° relationship this
// project's court art has is purely a DISPLAY concern, handled in
// NbaLineupSection.tsx with a CSS transform on the whole overlay, not
// here.

export type ShotZone = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface ShotMarker {
  // Percent of the half-court image's own width/height, clamped to
  // [1, 99] -- a literal recorded position can land a hair outside
  // bref's own nominal 500x469.78 canvas (deep corner/baseline shots,
  // half-court heaves, recording imprecision; same handful of shots
  // the zone classifier's own radius search above treats as edge
  // cases), which without clamping would render the marker past the
  // edge of this project's own (differently proportioned) court art.
  // Clamping keeps every real shot visible on the floor instead of
  // dropping or relocating it.
  xPct: number;
  yPct: number;
  made: boolean;
  playerId: string;
  // bref's own period number (1-4 regulation, 5+ overtime), straight
  // from bbr_shot_chart.period -- null on the rare row that's missing
  // it, which the Quarter filter just treats as never matching a
  // specific quarter (still shows under "All Quarters").
  period: number | null;
  // Which of the 9 zones this shot falls in (see ShotZone), or null
  // for the residual few shots the classifier can't place even after
  // its radius search (same genuinely out-of-bounds cases as the
  // display clamp above). The "Shots By Zone Eff"/"Shot By Zone Cnt"
  // chart types aggregate make/attempt counts from this directly
  // client-side (respecting whatever Players/Quarter filter is
  // active), rather than this file shipping a separate
  // always-every-shot aggregate.
  zone: ShotZone | null;
  // bref's own game_id (e.g. "202610250OKC") for the game this shot
  // was actually taken in -- lets the Lookback filter narrow down to
  // just GameShotChart.currentGameId client-side, the same way
  // Players/Quarter already filter, instead of a second server round
  // trip for "Current Game" vs "Season to Date".
  gameId: string;
}

export interface TeamShotPlayer {
  id: string; // bref player code, e.g. "tatumja01"
  name: string;
}

export interface TeamShotChart {
  shots: ShotMarker[]; // every individual shot, for the raw shot-selection view
  players: TeamShotPlayer[]; // every player with >=1 shot, sorted by name, for the player filter
}

export interface GameShotChart {
  home: TeamShotChart;
  away: TeamShotChart;
  // This specific matchup's own bref game_id -- what the Lookback
  // filter's "Current Game" option compares each ShotMarker.gameId
  // against.
  currentGameId: string;
}

// bref's own shot-chart canvas: court-nba-bbr.svg (viewBox 0 0 910
// 855) rendered at width:500px -- confirmed directly from a real
// scraped page's own markup (`<img src=".../court-nba-bbr.svg"
// style="width:500px;">`), not inferred. Height follows the same
// uniform width-only CSS scale.
const BREF_CANVAS_WIDTH = 500;
const BREF_CANVAS_HEIGHT = (500 * 855) / 910;

const ZONE_COUNT = 9;

interface ZoneMasks {
  width: number;
  height: number;
  // One alpha-channel buffer per zone (index 0 = zone 1, etc.) --
  // 255 where that pixel belongs to the zone, 0 elsewhere.
  alpha: Uint8Array[];
}

// Loaded once per server process and reused across every request --
// these are small (600x565) static assets that never change at
// runtime, so there's no reason to re-decode them on every page view.
let zoneMasksPromise: Promise<ZoneMasks> | null = null;
function loadZoneMasks(): Promise<ZoneMasks> {
  if (!zoneMasksPromise) {
    zoneMasksPromise = (async () => {
      const alpha: Uint8Array[] = [];
      let width = 0;
      let height = 0;
      for (let z = 1; z <= ZONE_COUNT; z++) {
        const file = path.join(process.cwd(), "public", "assets", "court", "zones9", `zone-${z}.png`);
        const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        width = info.width;
        height = info.height;
        const a = new Uint8Array(width * height);
        for (let i = 0; i < width * height; i++) a[i] = data[i * 4 + 3];
        alpha.push(a);
      }
      return { width, height, alpha };
    })();
  }
  return zoneMasksPromise;
}

function zoneAt(mx: number, my: number, masks: ZoneMasks): number {
  if (mx < 0 || mx >= masks.width || my < 0 || my >= masks.height) return -1;
  const idx = my * masks.width + mx;
  for (let z = 0; z < ZONE_COUNT; z++) {
    if (masks.alpha[z][idx] > 128) return z;
  }
  return -1;
}

// Returns a 0-based zone index (0 = zone 1 ... 8 = zone 9), or -1 if
// no zone is found even after the fallback search below.
//
// The exact pixel a shot's (topPx, leftPx) maps to is sometimes a
// WALL pixel, not a genuine gap between zones -- confirmed live: a
// real shot recorded essentially at the rim (distance_ft: 3) mapped
// to a pixel sitting right on the backboard/rim glyph's own black
// line art, which this project's own flood fill (same as every other
// black or blue line in the source image) correctly treats as a zone
// boundary, not fillable area. Basketball-reference's shot markers
// are only accurate to a few pixels anyway (hence shots clustering
// exactly on a rim/line glyph in the first place), so this searches
// a small, growing radius outward for the nearest real zone pixel
// instead of discarding a shot that's unambiguously "right there" at
// the rim, on an arc, or on a zone divider.
//
// 12 wasn't wide enough for every real shot -- confirmed live (the
// "Shot By Zone Cnt" denominators summing to less than the real game
// total): deep corner-3 attempts can have left_px at or even past 0
// (observed: 1, 1, -2 for three real misses in one game), but zone 1
// and zone 5's own mask content starts ~20px in from the canvas edge
// (that margin is real court art -- the sideline/baseline border --
// not fillable floor), so a shot recorded 12+ pixels into that margin
// could never reach real zone content within the old cap. 50 covers
// every case seen in real data with real margin to spare, while
// staying far short of a runaway scan (this only runs the full search
// at all for the rare shot the direct pixel misses).
function classify(topPx: number, leftPx: number, masks: ZoneMasks): number {
  const xFrac = leftPx / BREF_CANVAS_WIDTH;
  const yFrac = topPx / BREF_CANVAS_HEIGHT;
  const mx = Math.round(xFrac * masks.width);
  const my = Math.round(yFrac * masks.height);

  const direct = zoneAt(mx, my, masks);
  if (direct !== -1) return direct;

  for (let radius = 1; radius <= 50; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        // Only check the ring at exactly this radius (already tried
        // every smaller one) so the first hit found is the nearest.
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const z = zoneAt(mx + dx, my + dy, masks);
        if (z !== -1) return z;
      }
    }
  }
  return -1;
}

interface ShotRow {
  team_name_abbr: string;
  result: string;
  top_px: number;
  left_px: number;
  player_code: string | null;
  period: number | null;
  game_id: string;
}

interface PlayerNameRow {
  player_id: string;
  name_display: string;
}

function clampPct(v: number): number {
  return Math.max(1, Math.min(99, v));
}

export async function getGameShotChart(
  season: number,
  gameDate: Date,
  homeTeam: string,
  awayTeam: string
): Promise<GameShotChart | null> {
  const brefHome = toBrefAlias(homeTeam);
  const brefAway = toBrefAlias(awayTeam);
  const asOfEtDate = etDateKey(gameDate);

  // Scoped to just these two teams -- nothing left in this file needs
  // a league-wide scan now that zone efficiency is an absolute-scale
  // color (see ShotChartControls' own "Shots By Zone Eff" comment),
  // not a vs-league-average one. The player-name lookup stays
  // unrestricted though (a trade can put a player on a different team
  // today than the one recorded on an old shot) -- same approach
  // nbaBrefCrosswalk.ts already uses for jersey/photo lookups, and
  // bbr_advanced is small enough that filtering wouldn't be worth the
  // extra query complexity.
  // bref's own game_id convention (confirmed against poll_shot_chart_db.py's
  // inverse parse): YYYYMMDD + "0" + the home team's own bref code.
  // Built here rather than looked up since every ingested game_id
  // already follows it exactly.
  const currentGameId = `${asOfEtDate.replace(/-/g, "")}0${brefHome}`;

  const [rows, nameRows, masks] = await Promise.all([
    query<ShotRow>(
      `SELECT team_name_abbr, result, top_px, left_px, player_code, period, game_id
       FROM nba.bbr_shot_chart
       WHERE season = $1 AND game_date <= $2::date AND team_name_abbr IN ($3, $4)`,
      [season, asOfEtDate, brefHome, brefAway]
    ),
    query<PlayerNameRow>(
      `WITH resolved AS (
         SELECT COALESCE(
           (SELECT MAX(snapshot_date) FROM nba.bbr_advanced WHERE season = $1 AND snapshot_date <= $2::date),
           (SELECT MIN(snapshot_date) FROM nba.bbr_advanced WHERE season = $1)
         ) AS snapshot_date
       )
       SELECT a.player_id, a.name_display
       FROM nba.bbr_advanced a
       CROSS JOIN resolved
       WHERE a.season = $1 AND a.snapshot_date = resolved.snapshot_date`,
      [season, asOfEtDate]
    ),
    loadZoneMasks(),
  ]);
  if (rows.length === 0) return null;

  const playerNameById = new Map(nameRows.map((r) => [r.player_id, r.name_display]));

  const byTeam = new Map<string, { shots: ShotMarker[]; playerIds: Set<string> }>();

  for (const r of rows) {
    let entry = byTeam.get(r.team_name_abbr);
    if (!entry) {
      entry = { shots: [], playerIds: new Set() };
      byTeam.set(r.team_name_abbr, entry);
    }
    const playerId = r.player_code ?? "";
    const zoneIdx = classify(r.top_px, r.left_px, masks);
    entry.shots.push({
      xPct: clampPct((r.left_px / BREF_CANVAS_WIDTH) * 100),
      yPct: clampPct((r.top_px / BREF_CANVAS_HEIGHT) * 100),
      made: r.result === "make",
      playerId,
      period: r.period,
      zone: zoneIdx === -1 ? null : ((zoneIdx + 1) as ShotZone),
      gameId: r.game_id,
    });
    if (playerId) entry.playerIds.add(playerId);
  }

  function build(brefAlias: string): TeamShotChart | null {
    const entry = byTeam.get(brefAlias);
    if (!entry) return null;
    const players: TeamShotPlayer[] = [...entry.playerIds]
      .map((id) => ({ id, name: playerNameById.get(id) ?? id }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { shots: entry.shots, players };
  }

  const home = build(brefHome);
  const away = build(brefAway);
  if (!home || !away) return null;

  return { home, away, currentGameId };
}
