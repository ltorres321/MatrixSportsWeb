"use client";

import { useEffect, useRef, useState } from "react";
import type { NbaGameDetail } from "@/lib/nbaGameDetail";
import type { LineupPlayer, CourtSlot } from "@/lib/nbaLineup";
import type { ShotMarker, TeamShotPlayer } from "@/lib/nbaShotChart";
import { teamLogoPath } from "@/lib/teamsNba";
import { teamPrimaryColorNba } from "@/lib/teamColorsNba";

// NBA equivalent of GameDetailView.tsx's MatchupsView (the NFL
// "Lineup" card) -- same anatomy (toggle header, shared field/court
// with both teams on it at once, a boxed card per player with a
// team-colored namebar, headshot, and a tier-colored value), but
// basketball-specific in three ways the user asked for directly:
//   1. "Offense"/"Defense" (a football personnel concept) becomes a
//      single "Starters"/"Second Team" toggle that applies to BOTH
//      teams at once -- basketball has no analogous "which team's
//      call determines the shared alignment" concept the way a
//      football snap does (nbaLineup.ts's own header explains why
//      "Second Team" means "next 5 by minutes," not a real named
//      bench-unit construct).
//   2. A real two-basket court image (public/assets/court/
//      Full_court-nba-bbr_.png, supplied by the user) instead of a
//      CSS-tiled field -- NFL's own field backdrop is explicitly
//      "out of scope" CSS per that file's comment; this one isn't.
//   3. Each card shows the player's own REAL position (PG/SG/SF/PF/C)
//      and PER, not a generic alignment code and a 0-100 PFF grade --
//      see nbaLineup.ts's SLOT_ORDER comment for why the 5 fixed court
//      spots are filled in position-rank order rather than requiring
//      an exact one-of-each-position match.

// Same suffix-stripping rule as GameDetailView.tsx's own lastName() --
// duplicated here since it's pure display formatting, same rationale
// as this file's sibling components for not sharing tiny helpers
// across files.
const NAME_SUFFIXES = new Set(["Jr.", "Sr.", "II", "III", "IV", "V"]);
function lastName(fullName: string): string {
  const tokens = fullName.trim().split(/\s+/);
  while (tokens.length > 1 && NAME_SUFFIXES.has(tokens[tokens.length - 1])) {
    tokens.pop();
  }
  return tokens[tokens.length - 1] ?? fullName;
}

function nbaEspnHeadshotUrl(espnId: string): string {
  return `https://a.espncdn.com/i/headshots/nba/players/full/${espnId}.png`;
}

// Same 7-step best-to-worst palette as the Overview page's Starter
// Grades/Team Grades cards (STAT_TIER_COLORS in NbaGameDetailView.tsx)
// -- duplicated rather than imported across files, same convention
// this codebase already uses for small pure-display constants (see
// e.g. ordinal() existing independently in both game-detail files).
const PER_TIER_COLORS = ["#0c5ea0", "#0287a5", "#00936e", "#18a33a", "#5eb90f", "#f1cf00", "#fd9700"];
// Same PER bands Starter Grades' own toggle uses (league average is
// 15.0 by construction -- see that card's own PER tooltip).
const PER_TIER_THRESHOLDS = [27, 23, 19, 15, 12, 8];

function perTierColor(per: number): string {
  for (let i = 0; i < PER_TIER_THRESHOLDS.length; i++) {
    if (per >= PER_TIER_THRESHOLDS[i]) return PER_TIER_COLORS[i];
  }
  return PER_TIER_COLORS[PER_TIER_COLORS.length - 1];
}

// Same luminance-lift trick as the Overview page's nbaEdgeAccentColor
// -- duplicated here for the same "small file-local helper" reason as
// perTierColor above.
function lineupAccentColor(alias: string): string {
  const hex = teamPrimaryColorNba(alias).replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (luminance >= 0.28) return teamPrimaryColorNba(alias);
  const lift = 0.28 - luminance + 0.18;
  const blend = (c: number) => Math.round(c + (255 - c) * lift);
  return `rgb(${blend(r)}, ${blend(g)}, ${blend(b)})`;
}

// (x%, y%) for each of the 5 fixed court spots, for the team whose
// basket is at the TOP of the court image (y=0). Standard position
// map, not a literal play diagram -- basketball has no fixed
// "alignment" the way a football formation does, so this places each
// slot at the court-realistic standard "default" spot: center near
// the rim, forwards at the wings/elbows, guards spread near half
// court. The home team's half mirrors this by flipping y (100 - y).
const SLOT_POSITION: Record<CourtSlot, { x: number; y: number }> = {
  C: { x: 50, y: 13 },
  SF: { x: 16, y: 24 },
  PF: { x: 84, y: 24 },
  // PG/SG moved further from half-court (44 -> 38) than a straight
  // mirror strictly needs -- at 44/56 the away and home rows sat only
  // 12% apart, close enough that the HOME row's own position-label
  // pill (rendered just above its card) visually landed on top of the
  // AWAY row's PER value underneath it (confirmed from a real
  // screenshot: Dončić/Reaves's PER boxes showed "PG"/"SG" instead of
  // a number -- that was George/Peterson's pills bleeding through,
  // not a data bug). 38/62 doubles the gap to 24%.
  PG: { x: 25, y: 38 },
  SG: { x: 75, y: 38 },
};

function LineupPlayerCard({
  player,
  alias,
  flipped,
}: {
  player: LineupPlayer;
  alias: string;
  flipped: boolean;
}) {
  const spot = SLOT_POSITION[player.slot];
  const top = flipped ? 100 - spot.y : spot.y;
  const tier = perTierColor(player.per);
  return (
    <div className="lineup-box" style={{ left: `${spot.x}%`, top: `${top}%` }}>
      <span className="lineup-box-position">{player.position}</span>
      <div className="lineup-box-card">
        <div className="lineup-box-namebar" style={{ background: lineupAccentColor(alias) }}>
          {player.jersey && <span className="lineup-box-jersey">#{player.jersey}</span>}
          <span className="lineup-box-lastname">{lastName(player.name)}</span>
        </div>
        {player.espnId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="player-headshot" src={nbaEspnHeadshotUrl(player.espnId)} alt="" style={{ width: 30, height: 30 }} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="player-headshot player-headshot-fallback"
            src={teamLogoPath(alias)}
            alt=""
            style={{ width: 30, height: 30 }}
          />
        )}
        <div className="lineup-box-grade" style={{ borderColor: tier, backgroundColor: `${tier}20` }}>
          <span className="lineup-box-grade-label stat-toggle-info">
            PER
            <div className="stat-toggle-tooltip">
              <strong>Player Efficiency Rating</strong>
              <span>
                A per-minute rating (John Hollinger) summing a player&apos;s positive contributions and subtracting
                the negative, league-adjusted so 15.0 = average.
              </span>
            </div>
          </span>
          <span className="lineup-box-grade-value">{player.per.toFixed(1)}</span>
        </div>
      </div>
    </div>
  );
}

// Quarter filter for the third dropdown -- "Half" is its own value
// (1st + 2nd quarter together), not a synonym for "All Quarters".
type QuarterFilter = "all" | "q1" | "q2" | "half" | "q3" | "q4";

const QUARTER_OPTIONS: { value: QuarterFilter; label: string }[] = [
  { value: "q1", label: "1st Quarter" },
  { value: "q2", label: "2nd Quarter" },
  { value: "half", label: "Half" },
  { value: "q3", label: "3rd Quarter" },
  { value: "q4", label: "4th Quarter" },
  { value: "all", label: "All Quarters" },
];

function matchesQuarter(period: number | null, filter: QuarterFilter): boolean {
  if (filter === "all") return true;
  if (period === null) return false;
  switch (filter) {
    case "q1":
      return period === 1;
    case "q2":
      return period === 2;
    case "half":
      return period === 1 || period === 2;
    case "q3":
      return period === 3;
    case "q4":
      return period === 4;
  }
}

// How far back a chart type's data reaches -- "Current Game" narrows
// to ShotMarker.gameId === the matchup's own GameShotChart.currentGameId
// (a client-side filter, not a second server fetch: the season-to-date
// query this page already loads already contains this game's own
// shots as a subset). "L5"/"L10" are the team's own 5/10 most recent
// games (including the current one), same client-side approach --
// see lastNGameIds below. "Season to Date" is the unfiltered existing
// behavior.
type Lookback = "currentGame" | "l5" | "l10" | "seasonToDate";

const LOOKBACK_OPTIONS: { value: Lookback; label: string }[] = [
  { value: "currentGame", label: "Current Game" },
  { value: "l5", label: "L5" },
  { value: "l10", label: "L10" },
  { value: "seasonToDate", label: "Season to Date" },
];

// bref's own game_id convention (YYYYMMDD + "0" + home team code,
// already relied on elsewhere -- see nbaShotChart.ts's own comment)
// means the game's date is just its own first 8 characters, no lookup
// needed.
function gameIdDateKey(gameId: string): string {
  return gameId.slice(0, 8);
}

// The N most recent distinct games present in `shots` (by date, ties
// broken by game_id), as of whatever date this page's shots already
// stop at -- there's nothing newer than "today" in the loaded data,
// so "most recent" here already means "most recent as of the current
// game." Computed from the full, unfiltered shot list (not whatever
// Players/Quarter filter happens to be active), so the N-game window
// itself never shrinks just because a filter excludes every shot from
// one of those games.
function lastNGameIds(shots: ShotMarker[], n: number): Set<string> {
  const dateByGame = new Map<string, string>();
  for (const s of shots) {
    if (!dateByGame.has(s.gameId)) dateByGame.set(s.gameId, gameIdDateKey(s.gameId));
  }
  const sorted = [...dateByGame.entries()].sort((a, b) => (a[1] < b[1] ? 1 : a[1] > b[1] ? -1 : 0));
  return new Set(sorted.slice(0, n).map(([gameId]) => gameId));
}

// Shared by both chart types below -- a shot that didn't survive the
// Players/Quarter filters plus whichever specific set of games is in
// scope, filtered once by the parent so the active overlay (dot
// markers, zone percentages/counts, or the Analysis diff) never has
// to re-derive it. `gameIds === null` means no game-window
// restriction at all (Season to Date).
function filterShotsByGames(
  shots: ShotMarker[],
  selectedPlayerIds: Set<string> | null,
  quarterFilter: QuarterFilter,
  gameIds: Set<string> | null
): ShotMarker[] {
  return shots.filter(
    (s) =>
      (selectedPlayerIds === null || selectedPlayerIds.has(s.playerId)) &&
      matchesQuarter(s.period, quarterFilter) &&
      (gameIds === null || gameIds.has(s.gameId))
  );
}

function lookbackGameIds(shots: ShotMarker[], lookback: Lookback, currentGameId: string): Set<string> | null {
  switch (lookback) {
    case "currentGame":
      return new Set([currentGameId]);
    case "l5":
      return lastNGameIds(shots, 5);
    case "l10":
      return lastNGameIds(shots, 10);
    case "seasonToDate":
      return null;
  }
}

function filterShots(
  shots: ShotMarker[],
  selectedPlayerIds: Set<string> | null,
  quarterFilter: QuarterFilter,
  lookback: Lookback,
  currentGameId: string
): ShotMarker[] {
  return filterShotsByGames(shots, selectedPlayerIds, quarterFilter, lookbackGameIds(shots, lookback, currentGameId));
}

// Two or more real shots can land on the exact same recorded pixel --
// confirmed live: this game alone has two rim-area spots where bref
// itself logged 3 distinct shots (different makes/misses) at the
// identical (top_px, left_px). Stacked exactly on top of each other,
// only the last one painted is visible, silently hiding the rest.
// Bucketing by a small grid cell (not just an exact match) also
// catches shots that are merely a pixel or two apart -- visually
// indistinguishable at this dot size even though technically
// different coordinates -- and spreads every shot in a bucket into a
// small ring around their shared spot so each one stays its own
// visible dot instead of a count only the database can see.
const OVERLAP_GRID_PCT = 0.5;
const OVERLAP_SPREAD_RADIUS_PCT = 0.9;

function spreadOverlappingShots(shots: ShotMarker[]): { shot: ShotMarker; xPct: number; yPct: number }[] {
  const buckets = new Map<string, ShotMarker[]>();
  for (const s of shots) {
    const key = `${Math.round(s.xPct / OVERLAP_GRID_PCT)}:${Math.round(s.yPct / OVERLAP_GRID_PCT)}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(s);
    else buckets.set(key, [s]);
  }
  const out: { shot: ShotMarker; xPct: number; yPct: number }[] = [];
  for (const bucket of buckets.values()) {
    if (bucket.length === 1) {
      out.push({ shot: bucket[0], xPct: bucket[0].xPct, yPct: bucket[0].yPct });
      continue;
    }
    const cx = bucket.reduce((sum, s) => sum + s.xPct, 0) / bucket.length;
    const cy = bucket.reduce((sum, s) => sum + s.yPct, 0) / bucket.length;
    bucket.forEach((s, i) => {
      const angle = (2 * Math.PI * i) / bucket.length;
      out.push({
        shot: s,
        xPct: cx + OVERLAP_SPREAD_RADIUS_PCT * Math.cos(angle),
        yPct: cy + OVERLAP_SPREAD_RADIUS_PCT * Math.sin(angle),
      });
    });
  }
  return out;
}

// Raw shot selection -- every individual shot plotted at its own real
// court position (ShotMarker.xPct/yPct, straight from bref's own
// top_px/left_px), green dot for a make and red "x" for a miss, same
// visual convention basketball-reference's own shot chart page uses.
// No percentages or zone aggregation shown here at all -- this view
// is literally just where the shots were and whether they went in.
function ShotChartOverlay({ shots, flipped }: { shots: ShotMarker[]; flipped: boolean }) {
  const positioned = spreadOverlappingShots(shots);
  return (
    <div className={`nba-shotchart-overlay ${flipped ? "nba-shotchart-overlay-flipped" : ""}`}>
      {positioned.map(({ shot: s, xPct, yPct }, i) =>
        s.made ? (
          <span
            key={i}
            className="nba-shotchart-marker nba-shotchart-make"
            style={{ left: `${xPct}%`, top: `${yPct}%` }}
          />
        ) : (
          <span
            key={i}
            className="nba-shotchart-marker nba-shotchart-miss"
            style={{ left: `${xPct}%`, top: `${yPct}%` }}
          >
            ×
          </span>
        )
      )}
    </div>
  );
}

// Each zone's own real position as a % of the half court's width/height
// -- the true pixel centroid of each zone's final mask (public/assets/
// court/zones9/zone-N.png, after the free-throw/half-court circles'
// decorative lines were reconnected into zones 7 and 9 -- see this
// file's own zone-mask build notes), not a guess.
const ZONE_LABEL_POSITION: Record<number, { x: number; y: number }> = {
  1: { x: 3.24, y: 15.89 },
  2: { x: 20.67, y: 23.74 },
  3: { x: 50.04, y: 21.02 },
  4: { x: 79.36, y: 23.82 },
  5: { x: 96.73, y: 16.01 },
  6: { x: 11.32, y: 70.38 },
  7: { x: 49.96, y: 51.43 },
  8: { x: 88.49, y: 70.53 },
  9: { x: 49.77, y: 79.86 },
};
const ZONE_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

// Explicit absolute thresholds, not vs-league-average -- same
// red/black/blue scale the user asked for directly: under 25% red,
// 25-35% black, 35%+ blue. (Black reads fine here specifically
// because the court itself is a light wood texture, unlike the dark
// chrome around it -- not the same "black-on-dark" bug the Quarter
// dropdown had.)
function zoneEffColor(pct: number): string {
  if (pct < 25) return "#e8231a";
  if (pct < 35) return "#111111";
  return "#1457e0";
}

// Shared by both zone chart types below -- makes/attempts per zone
// from a (Players/Quarter/Lookback-filtered) shot list.
function aggregateZoneShots(shots: ShotMarker[]): { makes: Partial<Record<number, number>>; attempts: Partial<Record<number, number>> } {
  const makes: Partial<Record<number, number>> = {};
  const attempts: Partial<Record<number, number>> = {};
  for (const s of shots) {
    if (s.zone === null) continue;
    attempts[s.zone] = (attempts[s.zone] ?? 0) + 1;
    if (s.made) makes[s.zone] = (makes[s.zone] ?? 0) + 1;
  }
  return { makes, attempts };
}

// How many distinct games a shot list actually spans -- used to turn
// a baseline's total zone attempts into a PER-GAME average (see
// AnalysisInput's own comment on why Zone Cnt's analysis needs this
// and Zone Eff's doesn't).
function distinctGameCount(shots: ShotMarker[]): number {
  return new Set(shots.map((s) => s.gameId)).size;
}

// The 5th per-half dropdown -- compares this ONE game's own per-zone
// numbers against a baseline (season/L5/L10), always using the
// literal current game as one side regardless of whatever the
// Lookback dropdown itself is set to (Lookback controls the primary
// %/fraction shown on the court; Analysis adds a second line
// underneath it, it never replaces what's already there -- see
// AnalysisInput). Disabled by explicit ask whenever Lookback is
// already "Season to Date" (comparing the season to itself) or Chart
// Type is "Shot Selection" (nothing to attach a per-zone comparison
// to on a raw dot chart).
type Analysis = "none" | "vsSeason" | "vsL5" | "vsL10";

const ANALYSIS_OPTIONS: { value: Analysis; label: string }[] = [
  { value: "none", label: "None" },
  { value: "vsSeason", label: "Current Game % vs Season %" },
  { value: "vsL5", label: "Current Game % vs L5" },
  { value: "vsL10", label: "Current Game % vs L10" },
];

function isAnalysisAvailable(lookback: Lookback, chartType: ChartType): boolean {
  return lookback !== "seasonToDate" && chartType !== "shotSelection";
}

function analysisBaselineLabel(analysis: Analysis): string {
  switch (analysis) {
    case "vsSeason":
      return "Season Average";
    case "vsL5":
      return "L5 Average";
    case "vsL10":
      return "L10 Average";
    case "none":
      return "";
  }
}

// What ZoneEfficiencyOverlay/ZoneCountOverlay need to add their own
// extra Analysis line -- the literal current game's own shots and the
// selected baseline's shots, each independent of whatever Lookback is
// driving the card's normal %/fraction display.
interface AnalysisInput {
  currentGameShots: ShotMarker[];
  baselineShots: ShotMarker[];
  baselineLabel: string;
}

// Strong red/dark green, not the site's own pale-green theme text
// color the subline was silently inheriting before (confirmed from a
// real screenshot: unreadable against the light pill background it
// sits on, which is light regardless of site theme). Direction-coded
// rather than a single neutral color -- "below" and "above" read at
// a glance this way, and it still can't be confused with
// zoneEffColor's own red/black/blue (an absolute FG% scale, nothing
// to do with this diff's sign).
const ANALYSIS_BELOW_COLOR = "#c41e1e";
const ANALYSIS_ABOVE_COLOR = "#0a6b2d";
const ANALYSIS_EVEN_COLOR = "#333333";

function analysisDiffColor(diff: number, isEven: boolean): string {
  if (isEven) return ANALYSIS_EVEN_COLOR;
  return diff >= 0 ? ANALYSIS_ABOVE_COLOR : ANALYSIS_BELOW_COLOR;
}

// "Shots By Zone Eff" -- each zone's own season-to-date FG% (from
// whatever Players/Quarter/Lookback filter is active), not per-shot
// markers. Zones with zero attempts show nothing rather than a
// misleading 0%. When Analysis is active, a second, smaller line
// underneath adds "+/-##.##% Above/Below [baseline] Average" --
// Current Game % minus the baseline's own %, never replacing the
// primary value above it. A zone needs real attempts on both sides to
// compare a percentage; one with zero on either side just omits the
// extra line (the primary % above it still shows as normal).
function ZoneEfficiencyOverlay({ shots, flipped, analysis }: { shots: ShotMarker[]; flipped: boolean; analysis: AnalysisInput | null }) {
  const { makes, attempts } = aggregateZoneShots(shots);
  const curAgg = analysis ? aggregateZoneShots(analysis.currentGameShots) : null;
  const baseAgg = analysis ? aggregateZoneShots(analysis.baselineShots) : null;
  return (
    <div className={`nba-shotchart-overlay ${flipped ? "nba-shotchart-overlay-flipped" : ""}`}>
      {ZONE_NUMBERS.map((zone) => {
        const att = attempts[zone] ?? 0;
        if (att === 0) return null;
        const pct = ((makes[zone] ?? 0) / att) * 100;
        const pos = ZONE_LABEL_POSITION[zone];

        let analysisLine: { text: string; color: string } | null = null;
        if (analysis && curAgg && baseAgg) {
          const curAtt = curAgg.attempts[zone] ?? 0;
          const baseAtt = baseAgg.attempts[zone] ?? 0;
          if (curAtt > 0 && baseAtt > 0) {
            const curPct = ((curAgg.makes[zone] ?? 0) / curAtt) * 100;
            const basePct = ((baseAgg.makes[zone] ?? 0) / baseAtt) * 100;
            const diff = curPct - basePct;
            const isEven = Math.abs(diff) < 0.005;
            analysisLine = {
              text: isEven
                ? `Even with ${analysis.baselineLabel}`
                : `${diff >= 0 ? "+" : "-"}${Math.abs(diff).toFixed(2)}% ${diff >= 0 ? "Above" : "Below"} ${analysis.baselineLabel}`,
              color: analysisDiffColor(diff, isEven),
            };
          }
        }

        return (
          <span
            key={zone}
            className="nba-zoneeff-label"
            style={{ left: `${pos.x}%`, top: `${pos.y}%`, color: zoneEffColor(pct) }}
          >
            {Math.round(pct)}%
            {analysisLine && (
              <span className="nba-zoneanalysis-subline" style={{ color: analysisLine.color }}>
                {analysisLine.text}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

// "Shot By Zone Cnt" -- each zone's raw makes-over-attempts count, as
// a stacked fraction (made on top, a rule, attempts below) rather
// than a percentage or side-by-side "12/34" -- the user's own ask,
// specifically so it still reads in the narrow corner/baseline zones
// where horizontal room is tightest. When Analysis is active, a
// second line underneath shows how many MORE or FEWER shots were
// taken from this zone tonight than the baseline's own per-game
// average there -- a raw count difference, not a percentage (that's
// Zone Eff's job): Current Game attempts minus (baseline's total
// attempts / the number of games the baseline actually spans).
// Shown as a whole number ("+/-##"), not Zone Eff's two decimals.
// Unlike Zone Eff, a baseline average of zero (never shot from there
// in that window) is itself a valid, meaningful comparison point, so
// this only skips the line when the baseline has no games at all to
// average over.
function ZoneCountOverlay({ shots, flipped, analysis }: { shots: ShotMarker[]; flipped: boolean; analysis: AnalysisInput | null }) {
  const { makes, attempts } = aggregateZoneShots(shots);
  const curAgg = analysis ? aggregateZoneShots(analysis.currentGameShots) : null;
  const baseAgg = analysis ? aggregateZoneShots(analysis.baselineShots) : null;
  const baseGameCount = analysis ? distinctGameCount(analysis.baselineShots) : 0;
  return (
    <div className={`nba-shotchart-overlay ${flipped ? "nba-shotchart-overlay-flipped" : ""}`}>
      {ZONE_NUMBERS.map((zone) => {
        const att = attempts[zone] ?? 0;
        if (att === 0) return null;
        const pos = ZONE_LABEL_POSITION[zone];

        let analysisLine: { text: string; color: string } | null = null;
        if (analysis && curAgg && baseAgg && baseGameCount > 0) {
          const curAtt = curAgg.attempts[zone] ?? 0;
          const baseAvg = (baseAgg.attempts[zone] ?? 0) / baseGameCount;
          const diff = curAtt - baseAvg;
          const rounded = Math.round(Math.abs(diff));
          const isEven = rounded === 0;
          analysisLine = {
            text: isEven
              ? `Even with ${analysis.baselineLabel}`
              : `${diff >= 0 ? "+" : "-"}${rounded} ${diff >= 0 ? "Above" : "Below"} ${analysis.baselineLabel}`,
            color: analysisDiffColor(diff, isEven),
          };
        }

        return (
          <span key={zone} className="nba-zonecnt-label" style={{ left: `${pos.x}%`, top: `${pos.y}%` }}>
            <span className="nba-zonecnt-made">{makes[zone] ?? 0}</span>
            <span className="nba-zonecnt-rule" />
            <span className="nba-zonecnt-attempts">{att}</span>
            {analysisLine && (
              <span className="nba-zoneanalysis-subline" style={{ color: analysisLine.color }}>
                {analysisLine.text}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

// A team's own player filter -- a dropdown that opens into a checkbox
// list (not a native multi-select, which needs a non-obvious
// ctrl/cmd-click to pick more than one and shows no visual trace of
// who else is selected once the box closes). `selected` holds
// specific chosen player ids; an EMPTY array means "All Players" --
// there's no separate sentinel value, so clearing every individual
// checkbox is itself the reset back to All, and the All checkbox is
// really just a one-click version of that. One of these per team (not
// one shared dropdown) so each court half has its own filter.
function TeamPlayerDropdown({
  alias,
  players,
  selected,
  onChange,
}: {
  alias: string;
  players: TeamShotPlayer[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleOutsideClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [open]);

  const allSelected = selected.length === 0;
  function togglePlayer(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }
  const summary = allSelected
    ? "All Players"
    : selected.length === 1
      ? (players.find((p) => p.id === selected[0])?.name ?? "1 Player")
      : `${selected.length} Players`;

  return (
    <div className="nba-shotchart-control" ref={rootRef}>
      <label>{alias} Players</label>
      <button
        type="button"
        className="nba-shotchart-dropdown-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{summary}</span>
        <span className="nba-shotchart-dropdown-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <div className="nba-shotchart-dropdown-panel">
          <label className="nba-shotchart-checklist-item nba-shotchart-checklist-all">
            <input type="checkbox" checked={allSelected} onChange={() => onChange([])} />
            All Players
          </label>
          {players.map((p) => (
            <label key={p.id} className="nba-shotchart-checklist-item">
              <input type="checkbox" checked={selected.includes(p.id)} onChange={() => togglePlayer(p.id)} />
              {p.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// Its own control per half -- each half can show a different chart
// type independent of the other (e.g. away's own shot selection next
// to home's own zone efficiency).
type ChartType = "shotSelection" | "zoneEff" | "zoneCnt";

function isZoneChartType(t: ChartType): boolean {
  return t === "zoneEff" || t === "zoneCnt";
}

function ChartTypeSelect({ id, value, onChange }: { id: string; value: ChartType; onChange: (next: ChartType) => void }) {
  return (
    <div className="nba-shotchart-control">
      <label htmlFor={id}>Chart Type</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as ChartType)}>
        <option value="shotSelection">Shot Selection</option>
        <option value="zoneEff">Shots By Zone Eff</option>
        <option value="zoneCnt">Shot By Zone Cnt</option>
      </select>
    </div>
  );
}

// The dropdown above Chart Type -- how far back this half's data
// reaches (see the Lookback type's own comment above).
function LookbackSelect({ id, value, onChange }: { id: string; value: Lookback; onChange: (next: Lookback) => void }) {
  return (
    <div className="nba-shotchart-control">
      <label htmlFor={id}>Lookback</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as Lookback)}>
        {LOOKBACK_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// The third per-half dropdown -- a plain single-select (not a
// checklist like Players, since a shot can only have happened in one
// quarter, there's nothing to multi-pick).
function QuarterSelect({ id, value, onChange }: { id: string; value: QuarterFilter; onChange: (next: QuarterFilter) => void }) {
  return (
    <div className="nba-shotchart-control">
      <label htmlFor={id}>Quarter</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as QuarterFilter)}>
        {QUARTER_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// The 5th per-half dropdown, under Quarter -- disabled (not hidden,
// per the explicit ask) whenever isAnalysisAvailable says this half's
// current Lookback/Chart Type combination can't support it.
function AnalysisSelect({
  id,
  value,
  onChange,
  available,
}: {
  id: string;
  value: Analysis;
  onChange: (next: Analysis) => void;
  available: boolean;
}) {
  return (
    <div className="nba-shotchart-control">
      <label htmlFor={id}>Analysis</label>
      <select id={id} value={value} disabled={!available} onChange={(e) => onChange(e.target.value as Analysis)}>
        {ANALYSIS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// "on the left side of the board" -- a Lookback + Chart Type + Players
// + Quarter dropdown quartet for EACH court half, laid out in a 2-row
// grid (.nba-shotchart-controls) that matches the court's own
// away/home split exactly: the away group sits at the top of the away
// half, the home group starts right at the half-court line (top of
// the home half), not pinned to the very bottom of the card where it
// was unreachable without scrolling.
function ShotChartControls({
  awayAlias,
  homeAlias,
  awayPlayers,
  homePlayers,
  awaySelected,
  onAwayChange,
  homeSelected,
  onHomeChange,
  awayQuarter,
  onAwayQuarterChange,
  homeQuarter,
  onHomeQuarterChange,
  awayChartType,
  onAwayChartTypeChange,
  homeChartType,
  onHomeChartTypeChange,
  awayLookback,
  onAwayLookbackChange,
  homeLookback,
  onHomeLookbackChange,
  awayAnalysis,
  onAwayAnalysisChange,
  homeAnalysis,
  onHomeAnalysisChange,
}: {
  awayAlias: string;
  homeAlias: string;
  awayPlayers: TeamShotPlayer[];
  homePlayers: TeamShotPlayer[];
  awaySelected: string[];
  onAwayChange: (next: string[]) => void;
  homeSelected: string[];
  onHomeChange: (next: string[]) => void;
  awayQuarter: QuarterFilter;
  onAwayQuarterChange: (next: QuarterFilter) => void;
  homeQuarter: QuarterFilter;
  onHomeQuarterChange: (next: QuarterFilter) => void;
  awayChartType: ChartType;
  onAwayChartTypeChange: (next: ChartType) => void;
  homeChartType: ChartType;
  onHomeChartTypeChange: (next: ChartType) => void;
  awayLookback: Lookback;
  onAwayLookbackChange: (next: Lookback) => void;
  homeLookback: Lookback;
  onHomeLookbackChange: (next: Lookback) => void;
  awayAnalysis: Analysis;
  onAwayAnalysisChange: (next: Analysis) => void;
  homeAnalysis: Analysis;
  onHomeAnalysisChange: (next: Analysis) => void;
}) {
  return (
    <div className="nba-shotchart-controls">
      <div className="nba-shotchart-controls-top">
        <LookbackSelect id="nba-shotchart-lookback-away" value={awayLookback} onChange={onAwayLookbackChange} />
        <ChartTypeSelect id="nba-shotchart-type-away" value={awayChartType} onChange={onAwayChartTypeChange} />
        <TeamPlayerDropdown alias={awayAlias} players={awayPlayers} selected={awaySelected} onChange={onAwayChange} />
        <QuarterSelect id="nba-shotchart-quarter-away" value={awayQuarter} onChange={onAwayQuarterChange} />
        <AnalysisSelect
          id="nba-shotchart-analysis-away"
          value={awayAnalysis}
          onChange={onAwayAnalysisChange}
          available={isAnalysisAvailable(awayLookback, awayChartType)}
        />
      </div>
      <div className="nba-shotchart-controls-bottom">
        <LookbackSelect id="nba-shotchart-lookback-home" value={homeLookback} onChange={onHomeLookbackChange} />
        <ChartTypeSelect id="nba-shotchart-type-home" value={homeChartType} onChange={onHomeChartTypeChange} />
        <TeamPlayerDropdown alias={homeAlias} players={homePlayers} selected={homeSelected} onChange={onHomeChange} />
        <QuarterSelect id="nba-shotchart-quarter-home" value={homeQuarter} onChange={onHomeQuarterChange} />
        <AnalysisSelect
          id="nba-shotchart-analysis-home"
          value={homeAnalysis}
          onChange={onHomeAnalysisChange}
          available={isAnalysisAvailable(homeLookback, homeChartType)}
        />
      </div>
    </div>
  );
}

type LineupMode = "starters" | "secondTeam" | "shotChart";

function NbaLineupToggle({ mode, onChange }: { mode: LineupMode; onChange: (m: LineupMode) => void }) {
  return (
    <div className="lineup-toggle-group" role="tablist">
      <button type="button" role="tab" aria-selected={mode === "starters"} className={mode === "starters" ? "active" : ""} onClick={() => onChange("starters")}>
        Starters
      </button>
      <button type="button" role="tab" aria-selected={mode === "secondTeam"} className={mode === "secondTeam" ? "active" : ""} onClick={() => onChange("secondTeam")}>
        Second Team
      </button>
      <button type="button" role="tab" aria-selected={mode === "shotChart"} className={mode === "shotChart" ? "active" : ""} onClick={() => onChange("shotChart")}>
        Shot Chart
      </button>
    </div>
  );
}

export default function NbaLineupSection({ game }: { game: NbaGameDetail }) {
  const [mode, setMode] = useState<LineupMode>("starters");
  // Empty array means "All Players" -- see TeamPlayerDropdown's own
  // comment. Separate state per team since each half now has its own
  // dropdown, not one shared control.
  const [awaySelectedPlayers, setAwaySelectedPlayers] = useState<string[]>([]);
  const [homeSelectedPlayers, setHomeSelectedPlayers] = useState<string[]>([]);
  const [awayQuarter, setAwayQuarter] = useState<QuarterFilter>("all");
  const [homeQuarter, setHomeQuarter] = useState<QuarterFilter>("all");
  const [awayChartType, setAwayChartType] = useState<ChartType>("shotSelection");
  const [homeChartType, setHomeChartType] = useState<ChartType>("shotSelection");
  const [awayLookback, setAwayLookback] = useState<Lookback>("currentGame");
  const [homeLookback, setHomeLookback] = useState<Lookback>("currentGame");
  const [awayAnalysis, setAwayAnalysis] = useState<Analysis>("none");
  const [homeAnalysis, setHomeAnalysis] = useState<Analysis>("none");

  if (!game.lineup) {
    return (
      <div className="stat-section">
        <h2>Matchups</h2>
        <div className="lineup-unavailable">Lineup data isn&apos;t available for this game yet.</div>
      </div>
    );
  }

  const awayAlias = game.awayTeam;
  const homeAlias = game.homeTeam;
  const awayPlayers = mode === "starters" ? game.lineup.away.starters : game.lineup.away.secondTeam;
  const homePlayers = mode === "starters" ? game.lineup.home.starters : game.lineup.home.secondTeam;

  const awaySelectedPlayerIds = awaySelectedPlayers.length > 0 ? new Set(awaySelectedPlayers) : null;
  const homeSelectedPlayerIds = homeSelectedPlayers.length > 0 ? new Set(homeSelectedPlayers) : null;
  const awayFilteredShots = game.shotChart
    ? filterShots(game.shotChart.away.shots, awaySelectedPlayerIds, awayQuarter, awayLookback, game.shotChart.currentGameId)
    : [];
  const homeFilteredShots = game.shotChart
    ? filterShots(game.shotChart.home.shots, homeSelectedPlayerIds, homeQuarter, homeLookback, game.shotChart.currentGameId)
    : [];

  // Analysis always compares the literal current game against a
  // baseline, independent of whatever the Lookback dropdown above is
  // set to -- so this is computed straight from the full shot list,
  // not from awayFilteredShots/homeFilteredShots.
  const awayAnalysisActive = isAnalysisAvailable(awayLookback, awayChartType) && awayAnalysis !== "none";
  const homeAnalysisActive = isAnalysisAvailable(homeLookback, homeChartType) && homeAnalysis !== "none";
  const awayAnalysisBaselineGameIds =
    awayAnalysisActive && game.shotChart
      ? awayAnalysis === "vsSeason"
        ? null
        : lastNGameIds(game.shotChart.away.shots, awayAnalysis === "vsL5" ? 5 : 10)
      : null;
  const homeAnalysisBaselineGameIds =
    homeAnalysisActive && game.shotChart
      ? homeAnalysis === "vsSeason"
        ? null
        : lastNGameIds(game.shotChart.home.shots, homeAnalysis === "vsL5" ? 5 : 10)
      : null;
  const awayCurrentGameShots = game.shotChart
    ? filterShotsByGames(game.shotChart.away.shots, awaySelectedPlayerIds, awayQuarter, new Set([game.shotChart.currentGameId]))
    : [];
  const homeCurrentGameShots = game.shotChart
    ? filterShotsByGames(game.shotChart.home.shots, homeSelectedPlayerIds, homeQuarter, new Set([game.shotChart.currentGameId]))
    : [];
  const awayAnalysisBaselineShots = game.shotChart
    ? filterShotsByGames(game.shotChart.away.shots, awaySelectedPlayerIds, awayQuarter, awayAnalysisBaselineGameIds)
    : [];
  const homeAnalysisBaselineShots = game.shotChart
    ? filterShotsByGames(game.shotChart.home.shots, homeSelectedPlayerIds, homeQuarter, homeAnalysisBaselineGameIds)
    : [];
  const awayAnalysisInput: AnalysisInput | null = awayAnalysisActive
    ? { currentGameShots: awayCurrentGameShots, baselineShots: awayAnalysisBaselineShots, baselineLabel: analysisBaselineLabel(awayAnalysis) }
    : null;
  const homeAnalysisInput: AnalysisInput | null = homeAnalysisActive
    ? { currentGameShots: homeCurrentGameShots, baselineShots: homeAnalysisBaselineShots, baselineLabel: analysisBaselineLabel(homeAnalysis) }
    : null;

  return (
    <div className="stat-section">
      <h2>Matchups</h2>
      <p className="stat-sub">
        {mode === "shotChart"
          ? "Every shot each team has taken this season, plotted at its real court location -- green is a make, red is a miss."
          : "Season-to-date PER for each team's real starters (per basketball-reference's own games-started data) or next 5 by minutes played. The 5 court spots are a standard position map, not a literal play -- each card shows the player's own real position, which won't always match one-of-each when a team's real lineup doesn't."}
      </p>
      <div className="lineup-card">
        <div className="lineup-card-header">
          <NbaLineupToggle mode={mode} onChange={setMode} />
        </div>
        <div className="lineup-field nba-lineup-field">
          <div className="nba-lineup-shotchart-row">
            {mode === "shotChart" && game.shotChart && (
              <ShotChartControls
                awayAlias={awayAlias}
                homeAlias={homeAlias}
                awayPlayers={game.shotChart.away.players}
                homePlayers={game.shotChart.home.players}
                awaySelected={awaySelectedPlayers}
                onAwayChange={setAwaySelectedPlayers}
                homeSelected={homeSelectedPlayers}
                onHomeChange={setHomeSelectedPlayers}
                awayQuarter={awayQuarter}
                onAwayQuarterChange={setAwayQuarter}
                homeQuarter={homeQuarter}
                onHomeQuarterChange={setHomeQuarter}
                awayChartType={awayChartType}
                onAwayChartTypeChange={setAwayChartType}
                homeChartType={homeChartType}
                onHomeChartTypeChange={setHomeChartType}
                awayLookback={awayLookback}
                onAwayLookbackChange={setAwayLookback}
                homeLookback={homeLookback}
                onHomeLookbackChange={setHomeLookback}
                awayAnalysis={awayAnalysis}
                onAwayAnalysisChange={setAwayAnalysis}
                homeAnalysis={homeAnalysis}
                onHomeAnalysisChange={setHomeAnalysis}
              />
            )}
            <div className={`nba-lineup-court-wrap ${mode === "shotChart" ? "nba-lineup-court-wrap-wide" : ""}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="nba-lineup-court" src="/assets/court/Full_court-nba-bbr_.png" alt="" />
              {mode === "shotChart" ? (
                <>
                  {/* Zone-boundary line art (no numbers -- that reference
                      version only exists to build the masks nbaShotChart.ts
                      classifies shots against) painted over just the half(s)
                      currently showing a zone chart type, so a half still on
                      Shot Selection keeps the plain court underneath. */}
                  {isZoneChartType(awayChartType) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className="nba-zoneeff-court-half nba-zoneeff-court-half-away"
                      src="/assets/court/Fullcourt-nba-bbr_SectionsBlueNum2Blnk.png"
                      alt=""
                    />
                  )}
                  {isZoneChartType(homeChartType) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className="nba-zoneeff-court-half nba-zoneeff-court-half-home"
                      src="/assets/court/Fullcourt-nba-bbr_SectionsBlueNum2Blnk.png"
                      alt=""
                    />
                  )}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="nba-shotchart-watermark" src={teamLogoPath(awayAlias)} alt="" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="nba-shotchart-watermark nba-shotchart-watermark-home" src={teamLogoPath(homeAlias)} alt="" />
                </>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="nba-lineup-watermark" src={teamLogoPath(homeAlias)} alt="" />
              )}
              <div className="lineup-field-half nba-lineup-field-half">
                {mode === "shotChart" ? (
                  game.shotChart ? (
                    <>
                      {awayChartType === "zoneEff" ? (
                        <ZoneEfficiencyOverlay shots={awayFilteredShots} flipped={false} analysis={awayAnalysisInput} />
                      ) : awayChartType === "zoneCnt" ? (
                        <ZoneCountOverlay shots={awayFilteredShots} flipped={false} analysis={awayAnalysisInput} />
                      ) : (
                        <ShotChartOverlay shots={awayFilteredShots} flipped={false} />
                      )}
                      {homeChartType === "zoneEff" ? (
                        <ZoneEfficiencyOverlay shots={homeFilteredShots} flipped analysis={homeAnalysisInput} />
                      ) : homeChartType === "zoneCnt" ? (
                        <ZoneCountOverlay shots={homeFilteredShots} flipped analysis={homeAnalysisInput} />
                      ) : (
                        <ShotChartOverlay shots={homeFilteredShots} flipped />
                      )}
                    </>
                  ) : (
                    <div className="lineup-field-empty">No shot chart data yet.</div>
                  )
                ) : (
                  <>
                    {awayPlayers.length === 0 ? (
                      <div className="lineup-field-empty">No {mode === "starters" ? "starters" : "second-team"} data yet.</div>
                    ) : (
                      awayPlayers.map((p) => <LineupPlayerCard key={p.playerId} player={p} alias={awayAlias} flipped={false} />)
                    )}
                    {homePlayers.length === 0 ? (
                      <div className="lineup-field-empty">No {mode === "starters" ? "starters" : "second-team"} data yet.</div>
                    ) : (
                      homePlayers.map((p) => <LineupPlayerCard key={p.playerId} player={p} alias={homeAlias} flipped />)
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
