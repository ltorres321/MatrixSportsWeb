"use client";

import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemberPreview, SHOW_MEMBER_PREVIEW_TOGGLE } from "@/lib/useMemberPreview";
import { teamByAlias, teamLogoPath } from "@/lib/teams";
import { scalePosition, type GameStat, type GameStatSide } from "@/lib/gameStats";
import type { Story } from "@/lib/stories";
import type { EdgeSide } from "@/lib/pffGrades";

// Shared shape for a value-vs-value comparison row -- used by every
// section that reuses EdgeTrack/EdgeValue (QB Matchup, Team Grades).
type EdgeTrackRow = { teamSide: EdgeSide | null; oppositionSide: EdgeSide | null };
import type { InjuryEntry } from "@/lib/injuries";
import type { StatWithRank, TeamPlayerGrades } from "@/lib/pffGameReport";
import type { FirstTouchdownEntry, PlayerPropEntry } from "@/lib/pffBettingEdge";
import {
  MIN_THREE_LEG_LEG_PROBABILITY,
  PARLAY_POOL_SIZE,
  type Parlay,
} from "@/lib/parlayHelper";
import type { LineupPlayer } from "@/lib/lineup";
import { teamPrimaryColor } from "@/lib/teamColors";
import AdFrame from "@/components/AdFrame";
import MobileAdFrame from "@/components/MobileAdFrame";
import AdUnit from "@/components/AdUnit";
import { TrendingUpArrow } from "@/components/MatchupCard";

const LIVE_REFRESH_MS = 20_000;

function teamDisplay(alias: string): string {
  const team = teamByAlias(alias);
  return team ? `${team.market} ${team.name}` : alias;
}

// Same thresholds/labels as the model's own margin_buckets() (Files
// 53/58/59/60) -- given the REAL signed home-team margin (positive =
// home won by that much, negative = home lost by that much), which of
// the six pregame buckets did the actual result land in.
function marginBucketLabel(signedHomeMargin: number): string {
  if (signedHomeMargin <= 0) return "Lost / Tied";
  if (signedHomeMargin <= 3) return "Won by 1-3";
  if (signedHomeMargin <= 7) return "Won by 4-7";
  if (signedHomeMargin <= 14) return "Won by 8-14";
  if (signedHomeMargin <= 21) return "Won by 15-21";
  return "Won by 21+";
}

function StickyBar({ game }: { game: GameStat }) {
  const showScore = game.status === "final" || game.status === "live";
  const statusWord = game.status === "final" ? "FINAL" : game.kickoff;
  return (
    <div className="game-sticky-bar">
      <div className="side">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={teamLogoPath(game.teamA.alias)} alt="" />
        <span>{game.teamA.alias}</span>
        <span className="prob">
          {showScore ? game.teamA.score : `${game.teamA.winProb}%`}
          {!showScore && <TrendingUpArrow show={game.teamA.trendingUp} />}
        </span>
      </div>
      <div className="vs">{statusWord}</div>
      <div className="side">
        <span className="prob">
          {!showScore && <TrendingUpArrow show={game.teamB.trendingUp} />}
          {showScore ? game.teamB.score : `${game.teamB.winProb}%`}
        </span>
        <span>{game.teamB.alias}</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={teamLogoPath(game.teamB.alias)} alt="" />
      </div>
    </div>
  );
}

function HeroTeam({ side, status }: { side: GameStatSide; status: GameStat["status"] }) {
  const showScore = status === "final" || status === "live";
  return (
    <div className="game-hero-team">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={teamLogoPath(side.alias)} alt={`${teamDisplay(side.alias)} logo`} />
      <div className="name">{teamDisplay(side.alias)}</div>
      <div className="record">{side.record}</div>
      {showScore ? (
        <div className="big-prob">{side.score}</div>
      ) : (
        <div className="big-prob">
          {side.winProb}
          <span className="unit">%</span>
        </div>
      )}
    </div>
  );
}

function Hero({ game }: { game: GameStat }) {
  return (
    <div className="game-hero">
      <div className="matchup-status" style={{ justifyContent: "center", marginBottom: "1.5rem" }}>
        {game.status === "final" ? (
          <span className="tag final">FINAL</span>
        ) : game.status === "live" ? (
          <span className="tag live">
            <span className="blip" />
            LIVE — {game.kickoff}
          </span>
        ) : (
          <span className="tag preview">{game.kickoff}</span>
        )}
      </div>
      <div className="game-hero-teams">
        <HeroTeam side={game.teamA} status={game.status} />
        <div className="game-hero-vs">VS</div>
        <HeroTeam side={game.teamB} status={game.status} />
      </div>
      <div className="game-hero-meta">
        Market line: {game.marketLine.spread}, total {game.marketLine.total} &middot; Model expected score:{" "}
        {teamDisplay(game.teamA.alias)} {game.expectedScore.teamA.toFixed(1)} &ndash; {teamDisplay(game.teamB.alias)}{" "}
        {game.expectedScore.teamB.toFixed(1)}
      </div>
    </div>
  );
}

function MarginSection({ game }: { game: GameStat }) {
  // These bars are the PREGAME forecast, frozen at kickoff -- they
  // never get rewritten after the fact. Once there's a real result,
  // highlighting which bar it actually landed in is what makes that
  // clear, rather than leaving a list of "Won by X%" percentages
  // sitting there with no visible link to what actually happened
  // (including, often, a bucket that didn't happen at all).
  const actualLabel = game.finalResult
    ? marginBucketLabel(
        game.finalResult.winnerAlias === game.teamB.alias ? game.finalResult.margin : -game.finalResult.margin
      )
    : null;

  return (
    <div className="stat-section">
      <h2>Margin of Victory — {teamDisplay(game.teamB.alias)} (Home)</h2>
      <p className="stat-sub">
        {actualLabel
          ? "Pregame odds for every possible outcome, simulated before kickoff -- the highlighted bar is what actually happened."
          : `How often each outcome happened for ${teamDisplay(game.teamB.alias)}, across every simulated version of this game.`}
      </p>
      <div className="bucket-list">
        {game.marginBuckets.map((b) => (
          <div className={`bucket-row ${b.label === actualLabel ? "bucket-actual" : ""}`} key={b.label}>
            <span className="bucket-label">
              {b.label}
              {b.label === actualLabel && <span className="actual-tag"> ← actual result</span>}
            </span>
            <div className="bucket-track">
              <div className="bucket-fill" style={{ width: `${b.pct}%` }} />
            </div>
            <span className="bucket-pct">{b.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TotalsSection({ game }: { game: GameStat }) {
  const actualTotal = game.finalResult?.totalScore;
  const hasMarketLine = game.totals.some((t) => t.isMarketLine);

  return (
    <div className="stat-section">
      <h2>Total Score — Over / Under</h2>
      <p className="stat-sub">
        Combined final score against five common lines
        {hasMarketLine ? ", plus this game's actual market line" : ""}
        {actualTotal !== undefined ? ` -- the real combined score was ${actualTotal}.` : "."}
      </p>
      <div className="totals-grid">
        {game.totals.map((t) => {
          const hit = actualTotal === undefined ? null : actualTotal > t.line ? "over" : "under";
          return (
            <div className={`totals-card ${t.isMarketLine ? "totals-market" : ""}`} key={t.line}>
              <div className="line">
                O/U LINE {t.line}
                {t.isMarketLine && <span className="market-line-tag"> MARKET LINE</span>}
              </div>
              <div className="split">
                <div className="over" style={{ width: `${t.over}%` }} />
                <div className="under" style={{ width: `${t.under}%` }} />
              </div>
              <div className="readout">
                {/* Over is always green, under is always red -- that
                    convention never changes. A checkmark next to
                    whichever one actually happened adds a second,
                    separate signal instead of recoloring either one,
                    since a third color there would compete with, not
                    reinforce, the green/red meaning. */}
                <span className={`over-pct ${hit === "over" ? "actual-hit" : ""}`}>
                  {t.over}% over{hit === "over" && " ✓"}
                </span>
                <span className={`under-pct ${hit === "under" ? "actual-hit" : ""}`}>
                  {t.under}% under{hit === "under" && " ✓"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PercentileSection({ game }: { game: GameStat }) {
  const p = game.marginPercentiles;
  const bandLeft = scalePosition(p.p25);
  const bandRight = scalePosition(p.p75);

  return (
    <div className="stat-section">
      <h2>Projected Margin Range — {teamDisplay(game.teamB.alias)} (Home)</h2>
      <p className="stat-sub">
        Negative means {teamDisplay(game.teamB.alias)} lost by that many points. The shaded band is the 25th&ndash;75th
        percentile; the dot is the median.
      </p>
      <div className="percentile-block">
        <div className="percentile-track">
          <div className="percentile-zero-line" style={{ left: `${scalePosition(0)}%` }} />
          <div className="percentile-band" style={{ left: `${bandLeft}%`, width: `${bandRight - bandLeft}%` }} />
          <div className="percentile-marker" style={{ left: `${scalePosition(p.p50)}%` }} />
          <div className="percentile-tick" style={{ left: `${scalePosition(p.p05)}%` }}>
            P05: {p.p05 > 0 ? "+" : ""}
            {p.p05}
          </div>
          <div className="percentile-tick percentile-tick-median" style={{ left: `${scalePosition(p.p50)}%` }}>
            Median: {p.p50 > 0 ? "+" : ""}
            {p.p50}
          </div>
          <div className="percentile-tick" style={{ left: `${scalePosition(p.p95)}%` }}>
            P95: {p.p95 > 0 ? "+" : ""}
            {p.p95}
          </div>
        </div>
      </div>
    </div>
  );
}

// PFF's own grade-quality color bands, reverse-engineered from a real
// rendered page (border-color/background-color on .grade-box-module
// across ~25 sampled grades, e.g. 92.8->#0c5ea0, 85.2->#0287a5,
// 76.7-80.9->#00936e, 69.4-74.7->#18a33a, 63.4-68.8->#5eb90f,
// 60.1-61.7->#f1cf00, 51.0->#fd9700). Breakpoints below are rounded to
// the nearest clean number since PFF's exact thresholds aren't public
// -- this is an approximation of their scale, not a reverse-engineered
// exact copy. The point is what PFF's own UI does: color the grade by
// how GOOD it is, not by which team it belongs to -- team identity
// lives in the bar underneath instead.
const GRADE_TIER_COLORS: [number, string][] = [
  [90, "#0c5ea0"],
  [85, "#0287a5"],
  [75, "#00936e"],
  [69, "#18a33a"],
  [63, "#5eb90f"],
  [55, "#f1cf00"],
  [0, "#fd9700"],
];

function gradeTierColor(grade: number): string {
  for (const [threshold, color] of GRADE_TIER_COLORS) {
    if (grade >= threshold) return color;
  }
  return GRADE_TIER_COLORS[GRADE_TIER_COLORS.length - 1][1];
}

// Several real team colors (GB's dark green, CHI/HOU's near-black
// navy, WAS's dark maroon) read as almost invisible as a bar fill
// against this page's own near-black background -- pickCardImage.tsx
// never hits this problem since it only uses these colors as a soft
// glow behind a logo, never as a foreground fill. Blending a dark
// color toward white before using it here keeps every team visually
// distinguishable without changing hue.
function edgeAccentColor(alias: string): string {
  const hex = teamPrimaryColor(alias).replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (luminance >= 0.28) return teamPrimaryColor(alias);
  const lift = 0.28 - luminance + 0.18;
  const blend = (c: number) => Math.round(c + (255 - c) * lift);
  return `rgb(${blend(r)}, ${blend(g)}, ${blend(b)})`;
}

// A single value box at one end of the row -- colored by the grade's
// own quality tier, with its league-wide rank underneath. Matches
// PFF's own team-grade comparison boxes exactly (see GRADE_TIER_COLORS).
// side is nullable for a real, non-error case: a player with no
// recorded snaps yet this season (e.g. a starter just back from a
// season-opening injury) has nothing to show for a per-stat row even
// though they're still the correct player to display -- matches the
// reference PFF page, which renders a blank/dash box for that side
// rather than hiding the whole row.
function EdgeValue({
  side,
  alias,
  align,
  highlightTop5 = false,
}: {
  side: EdgeSide | null;
  alias: string;
  align: "left" | "right";
  // Off by default -- only Team Grades passes this. QB Matchup's rank
  // isn't against a fixed, reliable pool (see architecture.md's own
  // note on that), so a "top 5" callout there would be misleading in
  // a way it isn't for Team Grades' fixed 32-team league rank.
  highlightTop5?: boolean;
}) {
  if (!side) {
    return (
      <div className={`edge-value edge-value-${align}`}>
        <span className="edge-value-team">{alias}</span>
        <div className="edge-value-box edge-value-box-empty">—</div>
      </div>
    );
  }
  const tier = gradeTierColor(side.grade);
  const isTop5 = highlightTop5 && side.rank !== null && side.rank <= 5;
  return (
    <div className={`edge-value edge-value-${align}`}>
      <span className="edge-value-team">{side.alias}</span>
      <div
        className={`edge-value-box ${isTop5 ? "edge-value-box-top5" : ""}`}
        style={{ borderColor: tier, backgroundColor: `${tier}20` }}
      >
        {side.grade.toFixed(1)}
      </div>
      <span className={`edge-value-rank ${isTop5 ? "edge-value-rank-top5" : ""}`}>
        {side.rankLabel.replace(" of ", " / ")}
      </span>
    </div>
  );
}

// One continuous bar spanning the full row, split at whatever point
// reflects each side's RELATIVE share of the two values (share = own
// value / sum of both) -- not an independently-scaled length per
// side. Confirmed against a real PFF page: e.g. 73.6 vs 71.9 renders
// as a 50.58%/49.42% split, which is exactly value/(a+b). Colored by
// team, with the smaller share slightly dimmed so the leading side
// reads clearly at a glance (PFF's own bar marks the smaller segment
// with a `data-behind` attribute for the same reason).
function EdgeTrack({
  row,
  lowerIsBetter = false,
}: {
  // Either side can be missing (a player with no recorded stat yet --
  // see EdgeValue's own comment). A relative-share bar needs both
  // real numbers to mean anything, so this renders nothing rather
  // than a misleading 100%-to-one-side bar when one is absent.
  row: EdgeTrackRow;
  // Bar LENGTH always tracks the raw value share (a bigger number is
  // a longer bar, full stop -- that reads naturally regardless of
  // which direction is "good"). Only the dimming changes: for a stat
  // like Turnover Worthy % where a SMALLER number is the better one,
  // the smaller bar is the one that should read as "ahead," so which
  // side gets dimmed flips. Without this, the better QB's own lower
  // TWP% would render as if they were behind.
  lowerIsBetter?: boolean;
}) {
  if (!row.teamSide || !row.oppositionSide) {
    return <div className="edge-track-v2 edge-track-v2-empty" />;
  }
  const total = row.teamSide.grade + row.oppositionSide.grade;
  const leftPct = total > 0 ? (row.teamSide.grade / total) * 100 : 50;
  const rightPct = 100 - leftPct;
  const leftBehind = lowerIsBetter ? leftPct > rightPct : leftPct < rightPct;
  const rightBehind = lowerIsBetter ? rightPct > leftPct : rightPct < leftPct;
  return (
    <div className="edge-track-v2">
      <div
        className={`edge-fill-v2 ${leftBehind ? "edge-fill-behind" : ""}`}
        style={{ width: `${leftPct}%`, background: edgeAccentColor(row.teamSide.alias) }}
      />
      <div
        className={`edge-fill-v2 ${rightBehind ? "edge-fill-behind" : ""}`}
        style={{ width: `${rightPct}%`, background: edgeAccentColor(row.oppositionSide.alias) }}
      />
    </div>
  );
}

// ----------------------------------------------------------------------
// PFF Game Report -- Highest Graded Players, QB Matchup, Efficiency
// and Scoring, Pressure Matchup, Team Grades. Deliberately placed
// after "Who Has the Edge?" below rather than folded into it -- these
// replicate PFF's own game-report page layout (a different framing:
// both teams' own numbers side by side, not cross-unit matchups) and
// stay a separate, independently-nullable block. Every section reuses
// gradeTierColor/EdgeValue/EdgeTrack/edgeAccentColor from the Edge
// section above rather than re-deriving grade colors or the
// relative-share bar math.
// ----------------------------------------------------------------------

// Same ordinal-suffix algorithm as pffGrades.ts's server-side
// ordinal() -- duplicated here since it's pure display formatting
// (this file already gets raw value+rank pairs, not pre-formatted
// "Nth of M" strings, from pffGameReport.ts's StatWithRank shape).
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

function toEdgeSide(alias: string, stat: StatWithRank | null | undefined, total: number): EdgeSide | null {
  if (!stat) return null;
  return {
    alias,
    grade: stat.value,
    rankLabel: stat.rank ? `${ordinal(stat.rank)} of ${total}` : `of ${total}`,
    rank: stat.rank,
  };
}

function espnHeadshotUrl(espnId: string): string {
  return `https://a.espncdn.com/i/headshots/nfl/players/full/${espnId}.png`;
}

// No generic player-photo placeholder exists elsewhere in this
// codebase (StickyBar/Hero only ever use teamLogoPath for TEAM logos)
// -- falling back to the player's own team logo, rather than
// hotlinking PFF's photos or inventing an initials-avatar system, for
// the real, if rarer, case of a player DynastyProcess's crosswalk
// hasn't mapped to an espn_id yet (see pff_api's module docstring).
function PlayerHeadshot({ espnId, alias, size }: { espnId: string | null; alias: string; size?: number }) {
  const style = size ? { width: size, height: size } : undefined;
  if (espnId) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img className="player-headshot" src={espnHeadshotUrl(espnId)} alt="" style={style} />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="player-headshot player-headshot-fallback" src={teamLogoPath(alias)} alt="" style={style} />
  );
}

function PlayerGradeBadgeRow({ player, alias }: { player: TeamPlayerGrades["offense"][number]; alias: string }) {
  const tier = gradeTierColor(player.grade);
  return (
    <div className="report-player-row">
      <PlayerHeadshot espnId={player.espnId} alias={alias} />
      <div className="report-player-info">
        <span className="report-player-name">{player.name}</span>
        {player.position && <span className="report-player-position">{player.position}</span>}
      </div>
      <div className="report-player-grade" style={{ borderColor: tier, backgroundColor: `${tier}20` }}>
        {player.grade.toFixed(1)}
      </div>
    </div>
  );
}

function HighestGradedPlayersCard({ alias, team }: { alias: string; team: TeamPlayerGrades }) {
  const [side, setSide] = useState<"offense" | "defense">("offense");
  const players = side === "offense" ? team.offense : team.defense;
  return (
    <div className="report-players-card">
      <div className="report-players-header">
        <span className="report-players-team">{alias}</span>
        <div className="report-toggle">
          <button type="button" className={side === "offense" ? "active" : ""} onClick={() => setSide("offense")}>
            Offense
          </button>
          <button type="button" className={side === "defense" ? "active" : ""} onClick={() => setSide("defense")}>
            Defense
          </button>
        </div>
      </div>
      {players.length === 0 ? (
        <div className="report-players-empty">No qualifying players.</div>
      ) : (
        <div className="report-players-list">
          {players.map((player) => (
            <PlayerGradeBadgeRow player={player} alias={alias} key={player.pffPlayerId} />
          ))}
        </div>
      )}
    </div>
  );
}

function HighestGradedPlayersSection({ game }: { game: GameStat }) {
  if (!game.playerGrades) return null;
  return (
    <div className="stat-section">
      <h2>Highest Graded Players</h2>
      <p className="stat-sub">
        Season-to-date PFF grades for each team&apos;s top graded players, minimum 25% of that side&apos;s snaps.
      </p>
      <div className="report-players-grid">
        <HighestGradedPlayersCard alias={game.teamA.alias} team={game.playerGrades.away} />
        <HighestGradedPlayersCard alias={game.teamB.alias} team={game.playerGrades.home} />
      </div>
    </div>
  );
}

// A plain (non grade-tier-colored) value box -- same box/rank markup
// as EdgeValue, minus the grade-quality border color, for a row that
// isn't a 0-100 PFF grade (a percentage, a time in seconds).
function PlainValue({
  side,
  alias,
  align,
  format,
}: {
  side: EdgeSide | null;
  alias: string;
  align: "left" | "right";
  format: (n: number) => string;
}) {
  if (!side) {
    return (
      <div className={`edge-value edge-value-${align}`}>
        <span className="edge-value-team">{alias}</span>
        <div className="edge-value-box edge-value-box-plain edge-value-box-empty">—</div>
      </div>
    );
  }
  return (
    <div className={`edge-value edge-value-${align}`}>
      <span className="edge-value-team">{side.alias}</span>
      <div className="edge-value-box edge-value-box-plain">{format(side.grade)}</div>
      <span className="edge-value-rank">{side.rankLabel.replace(" of ", " / ")}</span>
    </div>
  );
}

function QbMatchupHeader({ game }: { game: GameStat }) {
  if (!game.qbMatchup) return null;
  const { home, away } = game.qbMatchup;
  const awayColor = edgeAccentColor(game.teamA.alias);
  const homeColor = edgeAccentColor(game.teamB.alias);
  return (
    <div
      className="qb-matchup-header"
      style={{ background: `linear-gradient(135deg, ${awayColor} 0%, ${awayColor} 45%, ${homeColor} 55%, ${homeColor} 100%)` }}
    >
      <div className="qb-matchup-header-side">
        <PlayerHeadshot espnId={away.espnId} alias={game.teamA.alias} size={64} />
        <div className="qb-matchup-header-name">
          <span className="qb-matchup-header-team">{game.teamA.alias}</span>
          {away.name}
        </div>
      </div>
      <div className="qb-matchup-header-vs">VS</div>
      <div className="qb-matchup-header-side qb-matchup-header-side-right">
        <div className="qb-matchup-header-name">
          <span className="qb-matchup-header-team">{game.teamB.alias}</span>
          {home.name}
        </div>
        <PlayerHeadshot espnId={home.espnId} alias={game.teamB.alias} size={64} />
      </div>
    </div>
  );
}

function QbMatchupSection({ game }: { game: GameStat }) {
  if (!game.qbMatchup) return null;
  const { home, away } = game.qbMatchup;
  const total = home.qualifyingCount;
  const homeAlias = game.teamB.alias;
  const awayAlias = game.teamA.alias;

  const gradeRows = [
    { label: "Overall Grade", home: toEdgeSide(homeAlias, home.overall, total), away: toEdgeSide(awayAlias, away.overall, total) },
    {
      label: "Clean Pocket Grade",
      home: toEdgeSide(homeAlias, home.cleanPocket, total),
      away: toEdgeSide(awayAlias, away.cleanPocket, total),
    },
    {
      label: "Pressure Grade",
      home: toEdgeSide(homeAlias, home.pressure, total),
      away: toEdgeSide(awayAlias, away.pressure, total),
    },
  ];

  const plainRows = [
    {
      label: "Big Time Throw %",
      home: toEdgeSide(homeAlias, home.bigTimeThrowPct, total),
      away: toEdgeSide(awayAlias, away.bigTimeThrowPct, total),
      format: (n: number) => `${n.toFixed(1)}%`,
    },
    {
      label: "Turnover Worthy %",
      home: toEdgeSide(homeAlias, home.turnoverWorthyPct, total),
      away: toEdgeSide(awayAlias, away.turnoverWorthyPct, total),
      format: (n: number) => `${n.toFixed(1)}%`,
    },
    {
      label: "Avg Time To Throw",
      home: toEdgeSide(homeAlias, home.avgTimeToThrow, total),
      away: toEdgeSide(awayAlias, away.avgTimeToThrow, total),
      format: (n: number) => `${n.toFixed(2)}s`,
    },
    {
      label: "Avg Depth of Target",
      home: toEdgeSide(homeAlias, home.avgDepthOfTarget, total),
      away: toEdgeSide(awayAlias, away.avgDepthOfTarget, total),
      format: (n: number) => n.toFixed(1),
    },
  ];

  return (
    <div className="stat-section">
      <h2>QB Matchup</h2>
      <p className="stat-sub">
        Each team&apos;s real current starting QB (per PFF&apos;s own depth chart) -- season-to-date PFF grades and
        passing profile, ranked against the league&apos;s other starters. A stat reads &ldquo;—&rdquo; when that
        player has no recorded snaps for it yet this season (e.g. just back from injury).
      </p>
      <div className="qb-matchup-card">
        <QbMatchupHeader game={game} />
        <div className="qb-matchup-rows">
          {gradeRows.map(
            (row) =>
              (row.home || row.away) && (
                <div className="edge-row-v2" key={row.label}>
                  <EdgeValue side={row.away} alias={awayAlias} align="left" />
                  <div className="edge-row-label">{row.label}</div>
                  <EdgeValue side={row.home} alias={homeAlias} align="right" />
                  <EdgeTrack row={{ teamSide: row.away, oppositionSide: row.home }} />
                </div>
              )
          )}
          {plainRows.map(
            (row) =>
              (row.home || row.away) && (
                <div className="edge-row-v2" key={row.label}>
                  <PlainValue side={row.away} alias={awayAlias} align="left" format={row.format} />
                  <div className="edge-row-label">{row.label}</div>
                  <PlainValue side={row.home} alias={homeAlias} align="right" format={row.format} />
                  <EdgeTrack
                    row={{ teamSide: row.away, oppositionSide: row.home }}
                    lowerIsBetter={row.label === "Turnover Worthy %"}
                  />
                </div>
              )
          )}
        </div>
      </div>
    </div>
  );
}

// Away figure+rank on the left, label centered, home figure+rank on
// the right -- matches PFF's own Efficiency and Scoring rows exactly
// (a plain figure/rank pair on each side, no grade-tier box, since
// these are EPA/rate/points stats, not 0-100 PFF grades). The earlier
// version stacked both teams' values in a narrow right-hand column,
// cramped and hard to scan -- this spreads them across the full row
// width like every other comparison section on this page.
function EfficiencyFigure({ stat, format, align }: { stat: StatWithRank | null; format: (n: number) => string; align: "left" | "right" }) {
  if (!stat) {
    return (
      <div className={`eff-figure-block eff-figure-block-${align}`}>
        <span className="eff-figure eff-figure-missing">—</span>
      </div>
    );
  }
  // Top-5-in-the-league callout -- safe to key off a plain "top 5"
  // check here (unlike QB Matchup's rank) since every Efficiency stat
  // ranks against the full, fixed 32-team league, never an ambiguous
  // qualifying pool.
  const isTop5 = stat.rank !== null && stat.rank <= 5;
  return (
    <div className={`eff-figure-block eff-figure-block-${align}`}>
      <span className={`eff-figure ${isTop5 ? "eff-figure-top5" : ""}`}>{format(stat.value)}</span>
      <span className={`eff-rank ${isTop5 ? "eff-rank-top5" : ""}`}>{stat.rank ? `${ordinal(stat.rank)}/32` : ""}</span>
    </div>
  );
}

function EfficiencyStatRow({
  label,
  away,
  home,
  format,
}: {
  label: string;
  away: StatWithRank | null;
  home: StatWithRank | null;
  format: (n: number) => string;
}) {
  if (!away && !home) return null;
  return (
    <div className="eff-row-v2">
      <EfficiencyFigure stat={away} format={format} align="left" />
      <span className="eff-row-label">{label}</span>
      <EfficiencyFigure stat={home} format={format} align="right" />
    </div>
  );
}

// PFF always shows the sign on EPA figures (+0.05, not 0.05) so a
// reader isn't left assuming every unsigned number is positive --
// only the negatives stood out before this fix.
function fmtEpa(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}`;
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function fmtPoints(n: number): string {
  return n.toFixed(1);
}

function EfficiencyCard({
  title,
  awayAlias,
  homeAlias,
  awayStats,
  homeStats,
}: {
  title: string;
  awayAlias: string;
  homeAlias: string;
  awayStats: NonNullable<GameStat["efficiency"]>["awayOffense"];
  homeStats: NonNullable<GameStat["efficiency"]>["homeOffense"];
}) {
  const awayColor = edgeAccentColor(awayAlias);
  const homeColor = edgeAccentColor(homeAlias);
  return (
    <div className="eff-card">
      <div
        className="eff-card-header"
        style={{ background: `linear-gradient(135deg, ${awayColor} 0%, ${awayColor} 45%, ${homeColor} 55%, ${homeColor} 100%)` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="eff-card-logo" src={teamLogoPath(awayAlias)} alt="" />
        <span className="eff-card-title">{title}</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="eff-card-logo" src={teamLogoPath(homeAlias)} alt="" />
      </div>
      <div className="eff-card-teams">
        <span>{awayAlias}</span>
        <span>{homeAlias}</span>
      </div>
      <div className="eff-card-rows">
        <EfficiencyStatRow label="EPA / Play" away={awayStats.epaPerPlay} home={homeStats.epaPerPlay} format={fmtEpa} />
        <EfficiencyStatRow
          label="EPA / Play (Passing)"
          away={awayStats.epaPerPlayPassing}
          home={homeStats.epaPerPlayPassing}
          format={fmtEpa}
        />
        <EfficiencyStatRow
          label="EPA / Play (Rushing)"
          away={awayStats.epaPerPlayRushing}
          home={homeStats.epaPerPlayRushing}
          format={fmtEpa}
        />
        <EfficiencyStatRow label="Success Rate" away={awayStats.successRate} home={homeStats.successRate} format={fmtPct} />
        <EfficiencyStatRow
          label="Success Rate (Passing)"
          away={awayStats.successRatePassing}
          home={homeStats.successRatePassing}
          format={fmtPct}
        />
        <EfficiencyStatRow
          label="Success Rate (Rushing)"
          away={awayStats.successRateRushing}
          home={homeStats.successRateRushing}
          format={fmtPct}
        />
        <EfficiencyStatRow
          label="Points Per Game"
          away={awayStats.pointsPerGame}
          home={homeStats.pointsPerGame}
          format={fmtPoints}
        />
      </div>
    </div>
  );
}

function EfficiencySection({ game }: { game: GameStat }) {
  if (!game.efficiency) return null;
  const { homeOffense, awayOffense, homeDefense, awayDefense } = game.efficiency;
  return (
    <div className="stat-section">
      <h2>Efficiency and Scoring</h2>
      <p className="stat-sub">Season-to-date EPA, success rate, and scoring, with each figure&apos;s league rank.</p>
      <div className="eff-grid">
        <EfficiencyCard
          title="Offense"
          awayAlias={game.teamA.alias}
          homeAlias={game.teamB.alias}
          awayStats={awayOffense}
          homeStats={homeOffense}
        />
        <EfficiencyCard
          title="Defense"
          awayAlias={game.teamA.alias}
          homeAlias={game.teamB.alias}
          awayStats={awayDefense}
          homeStats={homeDefense}
        />
      </div>
    </div>
  );
}

// A "top 5" callout is safe here too -- pressure rate always ranks
// against the full, fixed 32-team league, same as Efficiency and
// Team Grades, never QB Matchup's ambiguous qualifying pool.
function PressureFigure({ label, stat }: { label: string; stat: StatWithRank | null }) {
  const isTop5 = stat?.rank !== null && stat?.rank !== undefined && stat.rank <= 5;
  return (
    <div className="pressure-figure">
      <span className="pressure-figure-label">{label}</span>
      <span className={`pressure-figure-value ${isTop5 ? "pressure-figure-value-top5" : ""}`}>
        {stat ? fmtPct(stat.value) : "—"}
      </span>
      <span className={`pressure-figure-rank ${isTop5 ? "pressure-figure-rank-top5" : ""}`}>
        {stat?.rank ? `${ordinal(stat.rank)} of 32` : ""}
      </span>
    </div>
  );
}

// Single-team color header + logo, matching the same treatment
// EfficiencyCard uses -- each tile is a "when THIS team has the ball"
// context, so one team's own color/logo (not a two-team blend) fits
// better than Efficiency's away-vs-home gradient.
function PressureTile({
  ballTeamAlias,
  title,
  leftLabel,
  leftStat,
  rightLabel,
  rightStat,
}: {
  ballTeamAlias: string;
  title: string;
  leftLabel: string;
  leftStat: StatWithRank | null;
  rightLabel: string;
  rightStat: StatWithRank | null;
}) {
  const color = edgeAccentColor(ballTeamAlias);
  return (
    <div className="pressure-tile">
      {/* Solid fill, not a gradient -- edgeAccentColor can return either
          a "#rrggbb" hex or an "rgb(r, g, b)" string (for a lightened
          color), and appending an alpha suffix like "cc" only works
          for the hex form. That produced invalid CSS ("rgb(...)cc")
          for any team whose color got lightened, which the browser
          then dropped entirely, falling back to a default background
          instead of that team's actual color (confirmed: LAR
          rendered green instead of blue). */}
      <div className="pressure-tile-header" style={{ background: color }}>
        <span className="pressure-tile-title">{title}</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="pressure-tile-logo" src={teamLogoPath(ballTeamAlias)} alt="" />
      </div>
      <div className="pressure-tile-figures">
        <PressureFigure label={leftLabel} stat={leftStat} />
        <div className="pressure-tile-divider">→</div>
        <PressureFigure label={rightLabel} stat={rightStat} />
      </div>
    </div>
  );
}

function PressureMatchupSection({ game }: { game: GameStat }) {
  if (!game.teamPressure) return null;
  const { home, away } = game.teamPressure;
  const awayName = teamDisplay(game.teamA.alias);
  const homeName = teamDisplay(game.teamB.alias);
  return (
    <div className="stat-section">
      <h2>Pressure Matchup</h2>
      <p className="stat-sub">Each team&apos;s O-line pressure allowed against the other team&apos;s pass rush generated.</p>
      <div className="pressure-grid">
        <PressureTile
          ballTeamAlias={game.teamA.alias}
          title={`When ${awayName} have the ball`}
          leftLabel={`${game.teamA.alias} pressure allowed`}
          leftStat={away.pressureRateAllowed}
          rightLabel={`${game.teamB.alias} pressure generated`}
          rightStat={home.pressureRateGenerated}
        />
        <PressureTile
          ballTeamAlias={game.teamB.alias}
          title={`When ${homeName} have the ball`}
          leftLabel={`${game.teamB.alias} pressure allowed`}
          leftStat={home.pressureRateAllowed}
          rightLabel={`${game.teamA.alias} pressure generated`}
          rightStat={away.pressureRateGenerated}
        />
      </div>
    </div>
  );
}

function TeamGradesSection({ game }: { game: GameStat }) {
  if (!game.teamGrades || game.teamGrades.length === 0) return null;
  const awayColor = edgeAccentColor(game.teamA.alias);
  const homeColor = edgeAccentColor(game.teamB.alias);
  return (
    <div className="stat-section">
      <h2>Team Grades</h2>
      <p className="stat-sub">Both teams&apos; own season-to-date PFF grades, side by side.</p>
      <div className="team-grades-card">
        {/* Same team-color gradient header as EfficiencyCard/PressureTile
            -- matches the reference PFF page exactly (logos left/right,
            "Grades ranked all 32 teams" centered), which this section
            was missing while the other two already had it. */}
        <div
          className="team-grades-header"
          style={{ background: `linear-gradient(135deg, ${awayColor} 0%, ${awayColor} 45%, ${homeColor} 55%, ${homeColor} 100%)` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="team-grades-logo" src={teamLogoPath(game.teamA.alias)} alt="" />
          <span className="team-grades-caption">Grades ranked all 32 teams</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="team-grades-logo" src={teamLogoPath(game.teamB.alias)} alt="" />
        </div>
        <div className="team-grades-rows">
          {game.teamGrades.map((row) => (
            <div className="edge-row-v2" key={row.label}>
              <EdgeValue side={row.away} alias={row.away.alias} align="left" highlightTop5 />
              <div className="edge-row-label">{row.label}</div>
              <EdgeValue side={row.home} alias={row.home.alias} align="right" highlightTop5 />
              <EdgeTrack row={{ teamSide: row.away, oppositionSide: row.home }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Matchups tab -- a formation-style depth chart for both teams' real
// starters (etl.pff_lineup, via SportsPipelines/pff_api/poll_lineup.py).
// PFF's own equivalent tab is called "Lineup" on their site; this page
// calls it "Matchups" instead, consistent with this page's existing
// "QB Matchup"/"Pressure Matchup" naming for a side-by-side comparison
// section, rather than introducing PFF's own name for the first time
// here. No personnel-package (11/21/12, Base/Nickel) picker -- out of
// scope, this project has no snap-by-package data.
// ----------------------------------------------------------------------

// Which half of the formation an alignment code reads as, purely from
// the code's own spelling -- confirmed against every real alignment
// code seen on a live poll (2026-09-28): LT/LG/LWR/LCB/LOLB/LILB etc.
// start with "L", RT/RG/RWR/RCB/ROLB/RILB etc. start with "R", "TE-L"/
// "TE-R" carry the side after a hyphen instead, and the defensive-
// line-specific codes (DLE/DLT/DRE/DRT) carry it as their SECOND
// character behind a "D". Everything else (NT, C, MLB/WLB/SLB, FS/SS,
// SWR, SCB, FB) has no side and reads as the formation's center/slot
// group.
function alignmentSide(alignment: string): "left" | "right" | "center" {
  const suffix = alignment.includes("-") ? alignment.split("-").pop()! : alignment;
  if (suffix.startsWith("L")) return "left";
  if (suffix.startsWith("R")) return "right";
  if (alignment.startsWith("D")) {
    if (alignment[1] === "L") return "left";
    if (alignment[1] === "R") return "right";
  }
  return "center";
}

function distanceForDefense(p: LineupPlayer): number {
  if (p.position === "DI" || p.position === "ED") {
    // A 3-4's stand-up OLB (position "ED", alignment LOLB/ROLB) is the
    // OUTERMOST rusher on the line -- further out than a true down
    // end, which is further out than the nose. Confirmed against PFF's
    // own front-row order (CB, ROLB, RE, NT, LE, LOLB, CB): giving OLB
    // the same distance as NT (this function's original bug) sorted it
    // next to the nose instead of out by the corner.
    if (p.alignment.includes("OLB")) return 3;
    if (p.alignment.endsWith("E")) return 2;
    if (p.alignment.endsWith("T")) return 1;
    return 0; // NT or similar
  }
  if (p.position === "LB") {
    if (p.alignment.includes("OLB")) return 2;
    if (p.alignment.includes("ILB")) return 1;
    return 0; // MLB/WLB/SLB
  }
  return 0;
}

// mirror=true for the front-seven groups (D-line/ED, LB) ONLY -- PFF
// (and real coaching terminology) names THOSE alignments' L/R from the
// DEFENSE's own point of view facing the offense, the mirror image of
// how offensive alignments are named (from the QB's point of view
// facing the same direction as the play). Confirmed directly against
// PFF's own Lineup tab: their front row reads (left to right) CB,
// ROLB, RE, NT, LE, LOLB, CB -- the "R"-named edge/tackle cluster on
// screen-LEFT, "L"-named on screen-RIGHT, exactly backwards from a
// literal reading of the letter -- and confirmed again for
// linebackers (RILB left of LILB). Offense alignments (LWR/RWR, TE-L/
// TE-R, LT/RT) are NOT mirrored, and neither are cornerbacks (see
// buildDefensePositions' own comment on leftCb/rightCb) -- those
// already render correctly screen-left/right as a literal reading.
function orderRow(players: LineupPlayer[], distanceFn: (p: LineupPlayer) => number, mirror = false): LineupPlayer[] {
  const signedKey = (p: LineupPlayer) => {
    let side = alignmentSide(p.alignment);
    if (mirror) side = side === "left" ? "right" : side === "right" ? "left" : "center";
    const d = distanceFn(p);
    return side === "left" ? -d : side === "right" ? d : 0;
  };
  return [...players].sort((a, b) => {
    const diff = signedKey(a) - signedKey(b);
    return diff !== 0 ? diff : a.alignment.localeCompare(b.alignment);
  });
}

// A position on the field, in percent: xPct is left-right (0 = left
// sideline, 100 = right), depthPct is distance from the line of
// scrimmage (0 = right on it, 100 = as deep as this diagram gets). Real
// field coordinates, not a flex-row guess -- this is what lines up a
// slot receiver, a TE, or a running back somewhere OTHER than a plain
// evenly-spaced row, matching PFF's own diagram instead of approximating
// it.
interface PositionedPlayer {
  player: LineupPlayer;
  xPct: number;
  depthPct: number;
}

// A real offensive personnel grouping is a fixed, league-wide slot
// template (same shape for every team -- only the players filling it
// differ), not a generic "show every WR/TE this team has" dump. Every
// code below is confirmed present, identically named, across every
// team's etl.pff_lineup rows (LWR/SWR/RWR, TE-L/TE-R, LT/LG/C/RG/RT,
// QB/HB/FB) -- verified directly against the DB for DEN/KC/MIA/BUF/LAR
// before writing this. Coordinates are hand-placed to match PFF's own
// diagram: outside receivers out at the sideline, the slot receiver
// tucked in and slightly off the line, the TE inline next to a tackle,
// and the backfield (QB, then HB/FB behind it) centered and deep. A
// slot's code list is tried in order and the first real match wins, so
// a team without a second alignment (e.g. BUF currently has no
// depth_order=1 FB) just quietly loses that slot rather than crashing
// or duplicating a player into two boxes.
type PersonnelPackage = "11" | "21" | "12";

const PERSONNEL_LABELS: Record<PersonnelPackage, string> = {
  "11": "11 (3 WR)",
  "21": "21 (2 RB)",
  "12": "12 (2 TE)",
};

// Coordinates keep a real anti-collision margin, not just a plausible-
// looking spot: any two slots whose x is within ~10 of each other also
// keep their depth at least ~22 apart, and vice versa, so a ~100px-tall
// card (see .lineup-box-card) never visually collides with its
// neighbor regardless of which alignments a given team actually has
// filled (confirmed by rendering real DEN/LAR/BUF rosters through
// every package/front combination -- see chat history for the render
// checks that caught the original QB/HB and LB/safety overlaps).
// depth=18 is the closest anything ever gets to the LOS (depth 0). A
// box is ~110px tall against this field's 500px-tall half (see
// .lineup-field-half), so its own half-height alone is ~11% -- depth
// 18 leaves a real ~7% gap instead of letting the box straddle the
// yellow line the way depth 8 did (confirmed as the actual bug: at
// depth 8 the box's near edge computed to a NEGATIVE offset, i.e. past
// the divider). The O-line got noticeably more width (32-68 instead of
// 35-65) since packed-together linemen were the single biggest
// complaint after the divider bug itself.
const OFFENSE_COORDS: Record<PersonnelPackage, { codes: string[]; x: number; depth: number }[]> = {
  "11": [
    { codes: ["LWR"], x: 6, depth: 22 },
    { codes: ["SWR"], x: 16, depth: 27 },
    { codes: ["LT"], x: 32, depth: 18 },
    { codes: ["LG"], x: 41, depth: 18 },
    { codes: ["C"], x: 50, depth: 18 },
    { codes: ["RG"], x: 59, depth: 18 },
    { codes: ["RT"], x: 68, depth: 18 },
    { codes: ["TE-R", "TE-L"], x: 79, depth: 25 },
    { codes: ["RWR"], x: 96, depth: 22 },
    { codes: ["QB"], x: 50, depth: 52 },
    { codes: ["HB"], x: 60, depth: 80 },
  ],
  "12": [
    { codes: ["LWR"], x: 6, depth: 22 },
    { codes: ["TE-L"], x: 21, depth: 25 },
    { codes: ["LT"], x: 32, depth: 18 },
    { codes: ["LG"], x: 41, depth: 18 },
    { codes: ["C"], x: 50, depth: 18 },
    { codes: ["RG"], x: 59, depth: 18 },
    { codes: ["RT"], x: 68, depth: 18 },
    { codes: ["TE-R"], x: 79, depth: 25 },
    { codes: ["RWR"], x: 96, depth: 22 },
    { codes: ["QB"], x: 50, depth: 52 },
    { codes: ["HB"], x: 60, depth: 80 },
  ],
  "21": [
    { codes: ["LWR"], x: 6, depth: 22 },
    { codes: ["LT"], x: 32, depth: 18 },
    { codes: ["LG"], x: 41, depth: 18 },
    { codes: ["C"], x: 50, depth: 18 },
    { codes: ["RG"], x: 59, depth: 18 },
    { codes: ["RT"], x: 68, depth: 18 },
    { codes: ["TE-R", "TE-L"], x: 79, depth: 25 },
    { codes: ["RWR"], x: 96, depth: 22 },
    { codes: ["QB"], x: 50, depth: 48 },
    { codes: ["FB"], x: 38, depth: 64 },
    { codes: ["HB"], x: 64, depth: 84 },
  ],
};

// Fills a personnel template from one team's real depth chart. A
// player is only ever placed in one slot -- if a fallback code (e.g.
// 12 personnel's single-TE slot falling back from TE-R to TE-L) would
// reuse a player another slot already claimed, that later slot is
// left empty instead of duplicating a box.
function buildOffensePositions(players: LineupPlayer[], pkg: PersonnelPackage): PositionedPlayer[] {
  const byAlignment = new Map(players.map((p) => [p.alignment, p]));
  const used = new Set<number>();
  const positioned: PositionedPlayer[] = [];
  for (const { codes, x, depth } of OFFENSE_COORDS[pkg]) {
    const match = codes.map((code) => byAlignment.get(code)).find((p) => p !== undefined && !used.has(p.pffPlayerId));
    if (match) {
      used.add(match.pffPlayerId);
      positioned.push({ player: match, xPct: x, depthPct: depth });
    }
  }
  return positioned;
}

type DefensiveFront = "base" | "nickel";

function evenX(index: number, count: number, left: number, right: number): number {
  return count <= 1 ? (left + right) / 2 : left + ((right - left) * index) / (count - 1);
}

// Unlike offense, defensive alignment CODES genuinely differ by scheme
// (a 3-4 team's D-line reads LE/NT/RE, a 4-3 team's reads DLT/DRT/
// DLE/DRE; edge rushers are the "ED" position either way -- see
// poll_lineup.py's own note on this), so the interior D-line/LB/safety
// counts vary by team and can't be a fixed coordinate table like
// offense. Instead each group gets a fixed DEPTH band (outside corners
// and the D-line right on the line, linebackers behind them, safeties
// deepest) and its real members are spread evenly left-to-right across
// a fixed x-range for that band -- real field bands, not a guess at
// exact per-alignment coordinates that don't exist league-wide. Base
// has no slot corner and keeps every linebacker; Nickel swaps in the
// slot corner and, to hold the total at 11, drops one linebacker
// (approximated as whichever orderRow places last -- a real defensive
// coordinator's actual sub-package rule varies by team and situation,
// beyond "line up the positions" for now).
function buildDefensePositions(players: LineupPlayer[], front: DefensiveFront): PositionedPlayer[] {
  const known = new Set(["DI", "ED", "CB", "LB", "S"]);
  const rawLine = players.filter((p) => p.position === "DI" || p.position === "ED");
  const rawLb = players.filter((p) => p.position === "LB");

  // Which real body sits for the slot corner in Nickel isn't fixed --
  // confirmed against real DEN data (2026-09-28): DEN's Base front is
  // 5-wide (ROLB/RE/NT/LE/LOLB), and their real Nickel drops the true
  // nose tackle (D.J. Jones, the one with distanceForDefense's lowest
  // magnitude -- i.e. the most interior lineman, not an edge piece)
  // and keeps BOTH linebackers, unlike a standard 4-man front, which
  // has no spare lineman to give up and drops a linebacker instead
  // (still an approximation -- see that drop's own comment below).
  let lineForFront = rawLine;
  let lbForFront = rawLb;
  if (front === "nickel") {
    if (rawLine.length > 4) {
      const minDist = Math.min(...rawLine.map(distanceForDefense));
      const dropIdx = rawLine.findIndex((p) => distanceForDefense(p) === minDist);
      lineForFront = rawLine.filter((_, i) => i !== dropIdx);
    } else {
      // Standard front, no spare lineman -- approximated as whichever
      // orderRow places last (a real DC's actual sub-package rule
      // varies by team and situation, beyond "line up the positions").
      lbForFront = orderRow(rawLb, distanceForDefense, true).slice(0, -1);
    }
  }
  const line = orderRow(lineForFront, distanceForDefense, true);
  const lb = orderRow(lbForFront, distanceForDefense, true);

  // The slot corner's ALIGNMENT code ("SCB") is trusted over its raw
  // `position` field, which is real but inconsistent across teams --
  // confirmed against the DB directly: DEN/KC/MIA/BUF all file SCB
  // under position "CB", but LAR files the exact same SCB alignment
  // under position "S". Trusting `position` alone meant LAR's slot
  // corner landed in the safety group and rendered in EVERY front,
  // including Base -- a real 12th-man-on-the-field bug (a slot corner
  // is a Nickel-only body), not just a cosmetic misplacement.
  const cb = players.filter((p) => p.position === "CB" || p.alignment === "SCB");
  const safety = [...players.filter((p) => p.position === "S" && p.alignment !== "SCB")].sort((a, b) =>
    a.alignment.localeCompare(b.alignment)
  );
  const other = players.filter((p) => !known.has(p.position) && p.alignment !== "SCB");

  // NOT mirrored, unlike the D-line/ED/LB groups below -- confirmed
  // against real DEN data (2026-09-28): Riley Moss (real alignment
  // LCB) renders on screen-LEFT and Pat Surtain II (real alignment
  // RCB) on screen-RIGHT on PFF's own Lineup tab, i.e. a literal
  // reading, same convention as offense's LWR/RWR. Corners are named
  // from the same fixed reference frame as the offense they're
  // covering; only the front-seven groups are named from the
  // defense's own point of view (see orderRow's mirror comment).
  const leftCb = cb.filter((p) => alignmentSide(p.alignment) === "left");
  const rightCb = cb.filter((p) => alignmentSide(p.alignment) === "right");
  const slotCb = cb.filter((p) => alignmentSide(p.alignment) === "center");

  // Same depth=18 minimum-from-LOS rule as offense (see OFFENSE_COORDS)
  // -- and, per feedback, the defense clusters noticeably tighter than
  // the O-line/WRs (narrower x-ranges throughout) rather than spread
  // out toward the sidelines.
  const positioned: PositionedPlayer[] = [];
  leftCb.forEach((p) => positioned.push({ player: p, xPct: 6, depthPct: 24 }));
  rightCb.forEach((p) => positioned.push({ player: p, xPct: 94, depthPct: 24 }));
  line.forEach((p, i) => positioned.push({ player: p, xPct: evenX(i, line.length, 30, 70), depthPct: 18 }));
  if (front === "nickel") {
    // x=18 clears the line's leftmost possible box (x=30, 5-wide 3-4
    // front) by more than a box-width on its own; depth (40) also
    // clears it independently, so either margin alone is enough.
    //
    // KNOWN LIMITATION, confirmed 2026-09-28 against real LAR data:
    // this picks the Nickel slot corner by alignment code ("SCB") --
    // the only signal this project's PFF Developer API tier exposes
    // for it (see the personnel-package research earlier the same day:
    // no per-game/per-snap personnel participation endpoint exists at
    // all, just this static depth-chart label). For LAR specifically,
    // that alignment-coded SCB is Trent McDuffie (position=CB,
    // depth_order=1, snap_pct=99.5%) -- but PFF's OWN Lineup tab's
    // Nickel diagram instead shows Quentin Lake (position=S, alignment
    // SS, snap_pct=100%) as the extra DB, i.e. a safety playing a
    // hybrid slot-corner role on real snaps. There is no field in our
    // data (position, alignment, or snap_pct) that distinguishes "this
    // team's real Nickel DB is actually a safety" from a normal SCB
    // team -- both McDuffie and Lake show ~full snap shares, so
    // snap_pct isn't a usable tiebreaker either. Decision (per the
    // project owner, same date): leave this on the real, data-backed
    // SCB alignment rather than guess at a heuristic favoring safeties
    // -- correct here just means "matches the depth chart," not
    // "matches PFF's own Nickel diagram for every team."
    slotCb.forEach((p) => positioned.push({ player: p, xPct: 18, depthPct: 40 }));
  }
  // Spread scales with how many linebackers this team actually has --
  // a fixed 45-70 range was sized for the common 2-linebacker (3-4)
  // case and left only ~5% between adjacent boxes for a true 3-backer
  // 4-3 team (MLB/SLB/WLB), well under the ~10% a box needs to clear
  // its neighbor (confirmed as the real cause of NYG's overlapping
  // MLB/SLB/WLB boxes). 10% per player keeps that same safe spacing
  // regardless of count.
  const lbSpread = Math.max(10, (lb.length - 1) * 10);
  const lbLeft = 50 - lbSpread / 2;
  const lbRight = 50 + lbSpread / 2;
  lb.forEach((p, i) => positioned.push({ player: p, xPct: evenX(i, lb.length, lbLeft, lbRight), depthPct: 48 }));
  // PFF's own reference isn't two safeties spread evenly -- one sits
  // shallow, tucked in close beside the linebackers (matching their
  // "#37 up and to the right of the LILB" look), the other sits deep
  // and off to the opposite side. Only meaningful for the common
  // 2-safety case; anything else falls back to an even spread.
  if (safety.length === 2) {
    positioned.push({ player: safety[0], xPct: 35, depthPct: 78 });
    // x=68 (vs LILB's 55) clears a box-width on its own so it no
    // longer overlaps the linebacker row it's tucked in beside.
    positioned.push({ player: safety[1], xPct: 68, depthPct: 65 });
  } else {
    safety.forEach((p, i) => positioned.push({ player: p, xPct: evenX(i, safety.length, 38, 62), depthPct: 74 }));
  }
  other.forEach((p, i) => positioned.push({ player: p, xPct: evenX(i, other.length, 45, 55), depthPct: 88 }));
  return positioned;
}

// Same convention as PFF's own boxes -- last name only, so it fits.
// Strips a trailing suffix (Jr./Sr./II-V) before taking the last
// whitespace-separated token, so "Warren McClendon Jr." reads
// "McClendon" rather than "Jr." A hyphenated surname like
// "Gardner-Johnson" is already one token, so it comes through whole.
const NAME_SUFFIXES = new Set(["Jr.", "Sr.", "II", "III", "IV", "V"]);
function lastName(fullName: string): string {
  const tokens = fullName.trim().split(/\s+/);
  while (tokens.length > 1 && NAME_SUFFIXES.has(tokens[tokens.length - 1])) {
    tokens.pop();
  }
  return tokens[tokens.length - 1] ?? fullName;
}

// Matches PFF's own card anatomy: the alignment code as a plain black
// pill OUTSIDE/above the card, the jersey+name on a team-colored bar
// as the card's own header, then the grade badge, then the rank text
// -- no headshot photo, which PFF's own Lineup-tab boxes don't carry
// either (unlike this page's other report cards). A player with no
// grade/rank yet (a real case -- a backup, or a defensive starter
// below the leaders endpoint's own qualifying snap share, see
// poll_lineup.py's module docstring) shows a dash, never a crash or a
// literal "null". Absolutely positioned at (xPct, topPct) within its
// half -- topPct is depthPct already converted for which half (top or
// bottom of the LOS divider) this box is in, see LineupFieldHalf.
function LineupPositionBox({
  pos,
  alias,
  topPct,
}: {
  pos: PositionedPlayer;
  alias: string;
  topPct: number;
}) {
  const { player } = pos;
  const tier = player.grade !== null ? gradeTierColor(player.grade) : null;
  // Same "top 5 turns yellow" convention as the Overview page's report
  // cards (.eff-rank-top5/.edge-value-rank-top5) -- same #ffd60a value,
  // kept fixed regardless of site theme like the rest of this feature.
  const isTop5 = player.gradeRank !== null && player.gradeRank <= 5;
  return (
    <div className="lineup-box" style={{ left: `${pos.xPct}%`, top: `${topPct}%` }}>
      <span className="lineup-box-position">{player.alignment}</span>
      <div className="lineup-box-card">
        <div className="lineup-box-namebar" style={{ background: edgeAccentColor(alias) }}>
          {player.jersey && <span className="lineup-box-jersey">#{player.jersey}</span>}
          <span className="lineup-box-lastname">{lastName(player.playerName)}</span>
        </div>
        <PlayerHeadshot espnId={player.espnId} alias={alias} size={26} />
        {player.grade !== null && tier !== null ? (
          <div className="lineup-box-grade" style={{ borderColor: tier, backgroundColor: `${tier}20` }}>
            {player.grade.toFixed(1)}
          </div>
        ) : (
          <div className="lineup-box-grade lineup-box-grade-empty">—</div>
        )}
        <span className={`lineup-box-rank ${isTop5 ? "lineup-box-rank-top5" : ""}`}>
          {player.gradeRank !== null && player.gradeRankOf !== null
            ? `${ordinal(player.gradeRank)} / ${player.gradeRankOf} ${player.alignment}`
            : "—"}
        </span>
      </div>
    </div>
  );
}

// One half of the field (above or below the LOS divider). depthPct is
// always "distance from the LOS" regardless of which half it's in --
// this flips it into an actual top% for whichever half is on top
// (farthest-from-LOS row ends up near that half's own top edge) versus
// the bottom (nearest-to-LOS row ends up right under the divider).
// Faint team-logo watermark centered in this half. A real pre-baked
// duotone asset (public/assets/field-watermarks/{ALIAS}.png), not a
// CSS mask -- a mask only sees the alpha channel, so every opaque
// pixel gets painted the SAME flat tint and all the logo's internal
// linework (feathers, shading, outlines) disappears into one flat
// silhouette. This asset instead keeps the source badge's real
// grayscale luminance (dark stays dark, light stays light) recolored
// through a single green duotone (black->#1c5a2e, white->#a8e6b0, via
// Pillow's ImageOps.colorize on the real transparent badge from
// public/assets/thumb-team-logos/{ALIAS}.png), which is what actually
// produces the embossed multi-tone look PFF's own site has -- verified
// by rendering a preview and comparing side by side before generating
// the full 32-team set. teamLogoPath's own /assets/team-logos set is
// untouched, used elsewhere for the real (non-watermark) team logo.
function LineupFieldWatermark({ alias }: { alias: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="lineup-field-watermark" src={`/assets/field-watermarks/${alias}.png`} alt="" />
  );
}

function LineupFieldHalf({
  positions,
  alias,
  isTop,
  emptyLabel,
}: {
  positions: PositionedPlayer[];
  alias: string;
  isTop: boolean;
  emptyLabel: string;
}) {
  if (positions.length === 0) {
    return (
      <div className="lineup-field-half">
        <LineupFieldWatermark alias={alias} />
        <div className="lineup-field-empty">{emptyLabel}</div>
      </div>
    );
  }
  return (
    <div className="lineup-field-half">
      <LineupFieldWatermark alias={alias} />
      {positions.map((pos) => (
        <LineupPositionBox
          key={pos.player.pffPlayerId}
          pos={pos}
          alias={alias}
          topPct={isTop ? 100 - pos.depthPct : pos.depthPct}
        />
      ))}
    </div>
  );
}

// Generic pill-button group backing all three header switches below --
// which team/unit, which offensive personnel package, which defensive
// front. Kept as one component so the three groups share one visual
// language instead of three near-duplicate button lists.
// Active state is a flat #ffd60a yellow, not a per-team color (see
// .lineup-toggle-group button.active) -- team colors here often
// rendered as a muted, low-contrast brown/olive depending on the team.
function LineupToggleGroup<T extends string>({
  options,
  active,
  onChange,
  label,
}: {
  options: readonly T[];
  active: T;
  onChange: (value: T) => void;
  label: (value: T) => ReactNode;
}) {
  return (
    <div className="lineup-toggle-group" role="tablist">
      {options.map((opt) => {
        const isActive = opt === active;
        return (
          <button
            key={opt}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={isActive ? "active" : ""}
            onClick={() => onChange(opt)}
          >
            {label(opt)}
          </button>
        );
      })}
    </div>
  );
}

// Mirrors PFF's own Lineup tab: ONE shared field, both teams on it at
// once, lined up as they actually would be for a real snap -- whichever
// unit the home team's toggle currently shows, the away team
// automatically fills the opposite unit (home offense vs away defense,
// or home defense vs away offense), never both teams' offenses or both
// defenses at the same time. The personnel-package and front switches
// apply to whichever team currently holds that unit, not to a fixed
// team -- a package is something the offense calls, a front is
// something the defense calls, regardless of home/away.
function MatchupsView({ game }: { game: GameStat }) {
  const [homeUnit, setHomeUnit] = useState<"offense" | "defense">("offense");
  const [offensePackage, setOffensePackage] = useState<PersonnelPackage>("11");
  const [defenseFront, setDefenseFront] = useState<DefensiveFront>("base");
  if (!game.lineup) {
    return (
      <div className="stat-section">
        <h2>Matchups</h2>
        <div className="lineup-unavailable">Lineup data isn&apos;t available for this game yet.</div>
      </div>
    );
  }

  const homeAlias = game.teamB.alias;
  const awayAlias = game.teamA.alias;
  const awayUnit = homeUnit === "offense" ? "defense" : "offense";

  // Matches PFF's own convention: the HOME team always renders on top,
  // in whichever unit its own toggle currently shows -- the away team
  // fills the complementary unit on the bottom. It's the team that's
  // fixed to a side, not the unit (an earlier version of this had
  // defense fixed to the top regardless of home/away, which is wrong).
  const topPositions =
    homeUnit === "offense"
      ? buildOffensePositions(game.lineup.home.offense, offensePackage)
      : buildDefensePositions(game.lineup.home.defense, defenseFront);
  const bottomPositions =
    awayUnit === "offense"
      ? buildOffensePositions(game.lineup.away.offense, offensePackage)
      : buildDefensePositions(game.lineup.away.defense, defenseFront);

  return (
    <div className="stat-section">
      <h2>Matchups</h2>
      <p className="stat-sub">
        {teamByAlias(homeAlias)?.name ?? homeAlias}&apos;s toggle picks the matchup — the other team automatically
        lines up as the opposing unit, same as a real snap. The personnel and front buttons are the same generic
        slot template for every team; only the real players filling each slot differ. Season-to-date PFF grade and
        its league-wide rank for that specific alignment slot (e.g. &ldquo;8th / 69 LT&rdquo;).
      </p>
      <div className="lineup-card">
        <div className="lineup-card-header">
          <LineupToggleGroup
            options={["offense", "defense"] as const}
            active={homeUnit}
            onChange={setHomeUnit}
            label={(u) => (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="lineup-switch-logo" src={teamLogoPath(homeAlias)} alt="" />
                {teamByAlias(homeAlias)?.name ?? homeAlias} {u === "offense" ? "Offense" : "Defense"}
              </>
            )}
          />
          <LineupToggleGroup
            options={["11", "21", "12"] as const}
            active={offensePackage}
            onChange={setOffensePackage}
            label={(pkg) => PERSONNEL_LABELS[pkg]}
          />
          <LineupToggleGroup
            options={["base", "nickel"] as const}
            active={defenseFront}
            onChange={setDefenseFront}
            label={(f) => (f === "base" ? "Base" : "Nickel")}
          />
        </div>
        {/* Deliberately just a CSS gradient "field" backdrop, not real
            yard-line/hash-mark SVG art -- out of scope for this feature.
            Each half is a real (x%, depth%) coordinate system, not flex
            rows -- see PositionedPlayer/LineupFieldHalf above. */}
        <div className="lineup-field">
          <LineupFieldHalf positions={topPositions} alias={homeAlias} isTop emptyLabel={`No ${homeUnit} lineup data yet.`} />
          <div className="lineup-los" />
          <LineupFieldHalf
            positions={bottomPositions}
            alias={awayAlias}
            isTop={false}
            emptyLabel={`No ${awayUnit} lineup data yet.`}
          />
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Betting Edge tab -- four independently-nullable sections (Game
// Lines, First Touchdown, Key Insights, Player Props), same "each
// section renders or doesn't based on its own data" convention as the
// Overview tab's five PFF report sections. All four source tables are
// manually fed by a separate pipeline -- see
// src/lib/pffBettingEdge.ts's module docstring.
// ----------------------------------------------------------------------

const PROP_TYPE_LABELS: Record<string, string> = {
  game_away_home_spread: "Spread",
  game_away_home_win: "Moneyline",
  game_point_total: "Total",
};

const CASH_TICKETS_INFO =
  "Cash = the share of all the money bet on this side. Tickets = the share of individual bets placed on it. " +
  "When they're far apart, it usually means a few big bettors are betting one way while most casual bettors " +
  "are betting the other.";

const EDGE_INFO =
  "Estimate of how good this bet is. It compares their model's true win probability for this side to what " +
  "the odds require just to break even. A positive Edge (green) means their model sees extra value here — " +
  "the bigger the number, the stronger the play. A negative Edge means there's no advantage; the price " +
  "already looks fair or worse, so most bettors would skip it.";

// Player Props computes Edge differently from Game Lines -- confirmed
// against real data (Malik Nabers: 92.8% Cov Prob at -111 odds gives
// exactly +76.4% through THIS formula; Game Lines' simpler "Cover% -
// Break-even%" gives a visibly different, wrong number on the same
// row). Both tools call the result "Edge" and both still mean "bigger
// positive number = PFF likes this more," but the actual math isn't
// the same, so this gets the formula appended rather than silently
// reusing EDGE_INFO as-is.
const EDGE_INFO_PLAYER_PROPS =
  EDGE_INFO + " Formula here: (Cover Probability × Sportsbook Payout) − 100%.";

// Source: data/raw/pff/player-props/PlayerProp_info.txt -- PFF's own
// column-by-column glossary for this table, lightly expanded into full
// sentences (the file itself is terse label fragments, e.g. "COV PROB:
// Coverage probability") to match the newbie-readable tone set by
// CASH_TICKETS_INFO/EDGE_INFO above, not reworded for substance. Edge
// isn't here -- its formula is handled separately below (EDGE_INFO_
// PLAYER_PROPS), since it's genuinely different math from Game Lines'
// Edge, not just a wording choice.
const PLAYER_PROP_COLUMN_INFO = {
  player: "The player this prop is for.",
  pRank:
    "Our model's rank of how likely this pick is to hit, among this game's own player props " +
    "-- 1 is the most likely to be correct. The smaller number in parentheses is that same " +
    "pick's rank across every player prop this week, league-wide.",
  consensus: "The standard line most sportsbooks are offering for this prop.",
  pick: "PFF's own recommended side for this prop.",
  proj: "PFF's own projected value for this stat.",
  l10Avg: "This player's average for this stat over their last 10 games.",
  covProb: "How often PFF's model expects this side of the line to actually hit.",
  defVsProp: "How the opponent's defense has performed against this specific prop recently.",
  matchup: "A grade for how favorable this matchup is for the player against the opposing defense.",
  simDef: "This player's hit rate in past games against defenses similar to this week's opponent.",
  l5: "This player's hit rate on this prop over their last 5 games.",
  l10: "This player's hit rate on this prop over their last 10 games.",
  h2h: "This player's hit rate on this prop in past meetings against this exact opponent.",
};

// PFF's own export names the book but never shows it on the page --
// a reader sees the price but not who's offering it. name/url/logo
// back a small clickable icon at the end of each First Touchdown row
// instead of a text column, so it reads as "which book" at a glance
// without widening the table.
//
// logo files are self-hosted at public/assets/favicons/<key>.png, not
// fetched live from Google's favicon service -- pulled once (2026-10)
// from each book's own domain via Google's lookup (so the *fetch* used
// Google, the running *site* never calls out to it) so a reader's
// request never depends on a third party staying up or keeping that
// endpoint working. Re-fetch if a book rebrands: see the download
// recipe this comment used to sit next to in git history, or just ask
// Claude to redo it the same way.
//
// Links to each book's general NFL section, not a specific bet/event
// id -- this data doesn't carry PFF's own per-bet deep-link id, and a
// hardcoded one would go stale (or point at the wrong game entirely)
// the moment it's reused for any game other than the one it was
// copied from. caesars.com itself silently redirects to williamhill.us
// (confirmed 2026-10 -- a real rebrand/redirect quirk, not a typo) --
// sportsbook.caesars.com is the actual working subdomain.
//
// EXCEPTION: Caesars's own /bet/americanfootball with no query string
// lands on COLLEGE football, not NFL (confirmed 2026-10 by actually
// clicking it) -- the `?id=` here isn't a specific bet/event after
// all, it's what tells Caesars's own router "NFL," so unlike the
// per-bet-id concern above, this one IS the stable, correct link to
// keep.
//
// The books below bovada are new (2026-10, from etl.player_prop_lines
// via SportsPipelines/prop_lines/ -- see sql/016's docstring) and their
// url is an unverified homepage root, not a click-through-confirmed
// NFL deep link like caesars/draftKings/betmgm/fanduel above -- safer
// to land on a page that definitely exists than guess a path that 404s.
const SPORTSBOOK_INFO: Record<string, { name: string; url: string; logo: string }> = {
  caesars: {
    name: "Caesars Sportsbook",
    url: "https://sportsbook.caesars.com/us/nj/bet/americanfootball?id=007d7c61-07a7-4e18-bb40-15104b6eac92",
    logo: "/assets/favicons/caesars.png",
  },
  draftKings: {
    name: "DraftKings",
    url: "https://sportsbook.draftkings.com/leagues/football/nfl",
    logo: "/assets/favicons/draftkings.png",
  },
  // Same book as draftKings above, under the lowercase key
  // etl.player_prop_lines.bookmaker actually uses (SportsPipelines'
  // prop_lines/ pollers store each source's own lowercase key) -- PFF's
  // CSV-derived pick_sportsbook uses the capital-K spelling instead, so
  // both keys need an entry or a line-shopped DraftKings quote falls
  // through to the plain-text "unknown book" display.
  draftkings: {
    name: "DraftKings",
    url: "https://sportsbook.draftkings.com/leagues/football/nfl",
    logo: "/assets/favicons/draftkings.png",
  },
  betmgm: {
    name: "BetMGM",
    url: "https://www.nj.betmgm.com/en/engage/lan/geolocator?orh=sports.betmgm.com",
    logo: "/assets/favicons/betmgm.png",
  },
  fanduel: {
    name: "FanDuel",
    url: "https://sportsbook.fanduel.com/navigation/nfl",
    logo: "/assets/favicons/fanduel.png",
  },
  // Not yet confirmed by click-through like the other four (seen in
  // Player Props' pick_sportsbook, not First Touchdown's set) -- same
  // "general section, not a specific bet" reasoning, but this URL is
  // a best guess, not a verified one.
  fanatics: {
    name: "Fanatics Sportsbook",
    url: "https://sportsbook.fanatics.com/",
    logo: "/assets/favicons/fanatics.png",
  },
  bovada: {
    name: "Bovada",
    url: "https://www.bovada.lv/",
    logo: "/assets/favicons/bovada.png",
  },
  hardrock: {
    name: "Hard Rock Bet",
    url: "https://app.hardrock.bet/",
    logo: "/assets/favicons/hardrock.png",
  },
  espnbet: {
    name: "ESPN BET",
    url: "https://espnbet.com/",
    logo: "/assets/favicons/espnbet.png",
  },
  pinnacle: {
    name: "Pinnacle",
    url: "https://www.pinnacle.com/",
    logo: "/assets/favicons/pinnacle.png",
  },
  betrivers: {
    name: "BetRivers",
    url: "https://www.betrivers.com/",
    logo: "/assets/favicons/betrivers.png",
  },
  betway: {
    name: "Betway",
    url: "https://betway.com/",
    logo: "/assets/favicons/betway.png",
  },
  fliff: {
    name: "Fliff",
    url: "https://www.getfliff.com/",
    logo: "/assets/favicons/fliff.png",
  },
  rebet: {
    name: "Rebet",
    url: "https://rebet.app/",
    logo: "/assets/favicons/rebet.png",
  },
  sportzino: {
    name: "Sportzino",
    url: "https://sportzino.com/",
    logo: "/assets/favicons/sportzino.png",
  },
  courtside: {
    name: "Courtside",
    url: "https://www.courtside.app/",
    logo: "/assets/favicons/courtside.png",
  },
};

function SportsbookLink({ sportsbook }: { sportsbook: string }) {
  const info = SPORTSBOOK_INFO[sportsbook];
  if (!info) return <span className="betting-sportsbook-unknown">{sportsbook}</span>;
  return (
    <a
      className="betting-sportsbook-link"
      href={info.url}
      target="_blank"
      rel="noopener noreferrer"
      title={`Odds via ${info.name}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={info.logo} alt={info.name} className="betting-sportsbook-icon" />
    </a>
  );
}

function formatOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

// matchupPosition is "No Matchup" for backups PFF didn't run a
// matchup analysis on -- that's a real, honest signal about matchup
// *grade* availability (left alone everywhere else this entry is
// used), but it isn't the right answer to "what position do they
// play," which lineupPosition (sourced independently, from the same
// roster data First Touchdown's position column uses) still usually
// knows even when PFF's own matchup field doesn't.
function displayPosition(entry: PlayerPropEntry): string | null {
  if (entry.matchupPosition && entry.matchupPosition !== "No Matchup") return entry.matchupPosition;
  return entry.lineupPosition;
}

// null pre-game (PFF hasn't graded it yet -- most props on this site,
// since most games haven't been played). Yellow check (this site's own
// accent color, not PFF's green) for a hit, red X for a miss -- same
// semantic PFF's own page uses, different color for the positive case
// to match the rest of the site's theme.
function PickResultIcon({ result }: { result: string | null }) {
  if (result === "correct") {
    return (
      <span className="pick-result-icon pick-result-correct" title="Hit" aria-label="Correct pick">
        ✓
      </span>
    );
  }
  if (result === "incorrect") {
    return (
      <span className="pick-result-icon pick-result-incorrect" title="Miss" aria-label="Incorrect pick">
        ✕
      </span>
    );
  }
  return null;
}

// Yellow check ONLY, never a red X here -- unlike Player Props (every
// prop has a clean correct/incorrect grade), First Touchdown and Game
// Lines are both single-winner markets: everyone/everything that
// didn't win isn't "wrong," they're just the other side of the same
// coin. A red X on every non-winner would be noise, not a real
// signal, so this only ever marks the one actual winner, once the
// game's final. Shared by First Touchdown's scorer flag and Game
// Lines' spread/moneyline/total results -- same visual, same
// single-winner reasoning, different source of "did this hit."
function HitCheckmark({ hit, title }: { hit: boolean; title: string }) {
  if (!hit) return null;
  return (
    <span className="pick-result-icon pick-result-correct" title={title} aria-label={title}>
      ✓
    </span>
  );
}

function sideLabel(sideType: string, game: GameStat): string {
  if (sideType === "away") return teamDisplay(game.teamA.alias).split(" ").pop() ?? sideType;
  if (sideType === "home") return teamDisplay(game.teamB.alias).split(" ").pop() ?? sideType;
  return sideType === "over" ? "Over" : sideType === "under" ? "Under" : sideType;
}

// null (not a dash) for over/under -- those sides have no team to show
// a logo for, and the row layout skips the logo slot entirely for them.
function sideAlias(sideType: string, game: GameStat): string | null {
  if (sideType === "away") return game.teamA.alias;
  if (sideType === "home") return game.teamB.alias;
  return null;
}

// `line` is stored once, signed from the HOME side (spread) -- the
// away side's number is the same magnitude, opposite sign. A total's
// line is shared as-is by both sides (Over 47.5 / Under 47.5).
function formatSideLine(propType: string, line: number | null, sideType: string): string {
  if (line == null) return "";
  if (propType === "game_point_total") return line.toFixed(1);
  const signed = sideType === "home" ? line : -line;
  return signed > 0 ? `+${signed}` : `${signed}`;
}

// Only ever returns true for the side that actually won -- never
// marks the losing side, same single-winner philosophy as First
// Touchdown's checkmark (every market here has exactly one real
// outcome, so there's nothing a red X would add beyond what the
// missing checkmark on the other side already says). A push
// (spread/total landing exactly on the line) correctly returns false
// for both sides -- neither "hit."
//
// `line` here is stored "home's quoted spread" (positive = home
// underdog) -- NOT SportsAnalytics's own "positive = good for home"
// internal convention used elsewhere in this project (File 46 etc.),
// so this is its own derivation, not a copy of that logic. Home
// covers when actual_margin > -line; away covers when
// actual_margin < -line -- verified against a real IND@WAS result
// before trusting this in the UI.
function didSideHit(
  propType: string,
  sideType: string,
  line: number | null,
  actualHomeScore: number | null,
  actualAwayScore: number | null
): boolean {
  if (line == null || actualHomeScore == null || actualAwayScore == null) return false;
  const margin = actualHomeScore - actualAwayScore;
  const total = actualHomeScore + actualAwayScore;

  if (propType === "game_point_total") {
    if (sideType === "over") return total > line;
    if (sideType === "under") return total < line;
    return false;
  }
  if (propType === "game_away_home_win") {
    if (sideType === "home") return actualHomeScore > actualAwayScore;
    if (sideType === "away") return actualAwayScore > actualHomeScore;
    return false;
  }
  if (sideType === "home") return margin > -line;
  if (sideType === "away") return margin < -line;
  return false;
}

// No info icon on the badge itself -- it renders once per row (every
// row in both Game Lines and Player Props use this), which made the
// same explanation repeat endlessly. The icon lives once at the top
// of each section instead (the header row above Game Lines' list, the
// "Edge" <th> in Player Props) -- see EDGE_INFO's usages.
function EdgeBadge({ pct }: { pct: number }) {
  const cls = pct > 2 ? "betting-edge-positive" : pct < -2 ? "betting-edge-negative" : "betting-edge-neutral";
  return (
    <span className={`betting-edge-badge ${cls}`}>
      {pct > 0 ? "+" : ""}
      {pct.toFixed(1)}%
    </span>
  );
}

// Same 3-segment bar as PFF's own "Best Game Bets" table -- a quick
// visual read of edge strength alongside the exact number, not a
// replacement for it. Segments filled only for positive edge (a
// negative/flat edge shows all three segments empty, same as PFF's
// own display).
function EdgeBar({ pct }: { pct: number }) {
  const filled = pct > 6 ? 3 : pct > 3 ? 2 : pct > 0 ? 1 : 0;
  return (
    <span className="betting-edge-bar" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span key={i} className={i < filled ? "betting-edge-bar-seg filled" : "betting-edge-bar-seg"} />
      ))}
    </span>
  );
}

// Own conditional-formatting heatmap for First Touchdown's EPA
// columns -- PFF's page has this too (their "Color Cells" toggle),
// but the color itself isn't a field in the export; it's computed
// from the number. Fixed bounds, not scaled against the live week's
// data range, so a given EPA value always reads as the same shade
// regardless of what else happens to be in that week's slate -- a
// deliberate choice over matching PFF's own (unknown) exact
// thresholds, which would need scraping their page to reverse-engineer
// and would drift the moment their own formula changes anyway.
//
// direction="low" inverts the scale (used for Opp Off EPA Per Play
// only) -- confirmed against a real PFF screenshot that a LOW value
// there colors green, not high, since it's the subtracted term in
// Difference (EPA Per Play minus Opp Off EPA Per Play): a struggling
// opponent offense is favorable context for this player's own
// first-TD odds, not unfavorable.
function epaCellStyle(
  value: number | null,
  direction: "high" | "low",
  maxAbs: number
): CSSProperties {
  if (value == null) return {};
  const clamped = Math.max(-maxAbs, Math.min(maxAbs, value));
  const signed = direction === "high" ? clamped : -clamped;
  const intensity = Math.abs(signed) / maxAbs; // 0..1
  const alpha = 0.1 + intensity * 0.35;
  return {
    backgroundColor: signed > 0 ? `rgba(57, 217, 138, ${alpha})` : `rgba(255, 107, 107, ${alpha})`,
  };
}

function GameLinesSection({ game }: { game: GameStat }) {
  const markets = game.bettingEdge?.bestGameBets ?? [];
  if (markets.length === 0) return null;

  return (
    <div className="stat-section">
      <h2>Game Lines</h2>
      <p className="stat-sub">
        The gap between their model&apos;s fair win probability and the price the market is actually offering,
        shown as expected value. Cash/Tickets is the public betting split (% of dollars wagered vs. % of
        individual bets) on each side. Not something this site calculates independently.
      </p>
      <div className="betting-lines-list betting-desktop-only">
        {/* Labels + info icons live here ONCE, not per row -- same
            explanation repeating on every one of the 6 rows below was
            the actual complaint being fixed. */}
        <div className="betting-line-header-row">
          <span>Pick</span>
          <span>
            Cash / Tickets
            <InfoTooltip text={CASH_TICKETS_INFO} />
          </span>
          <span>
            Edge
            <InfoTooltip text={EDGE_INFO} />
          </span>
        </div>
        {markets.map((m) =>
          [
            { type: m.sideOneType, odds: m.sideOneOdds, edge: m.sideOneEdgePct, cash: m.sideOneCashPct, tickets: m.sideOneTicketsPct },
            { type: m.sideTwoType, odds: m.sideTwoOdds, edge: m.sideTwoEdgePct, cash: m.sideTwoCashPct, tickets: m.sideTwoTicketsPct },
          ].map((side) => {
            const alias = sideAlias(side.type, game);
            return (
              <div className="betting-line-full-row" key={`${m.propType}-${side.type}`}>
                <div className="betting-line-pick">
                  {alias ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="betting-line-logo" src={teamLogoPath(alias)} alt="" />
                  ) : (
                    <span className="betting-line-logo betting-line-logo-blank" aria-hidden="true" />
                  )}
                  <span className="betting-line-pick-text">
                    <span className="betting-line-side">
                      {sideLabel(side.type, game)} {formatSideLine(m.propType, m.line, side.type)}
                      <HitCheckmark
                        hit={didSideHit(m.propType, side.type, m.line, m.actualHomeScore, m.actualAwayScore)}
                        title="This side hit"
                      />
                    </span>
                    <span className="betting-line-odds">{formatOdds(side.odds)}</span>
                  </span>
                  <span className="betting-line-market">{PROP_TYPE_LABELS[m.propType] ?? m.propType}</span>
                </div>
                <div className="betting-line-split">
                  {side.cash != null && side.tickets != null ? (
                    <>
                      <span>
                        {side.cash}% <strong>Cash</strong>
                      </span>
                      <span>
                        {side.tickets}% <strong>Tickets</strong>
                      </span>
                    </>
                  ) : (
                    <span className="betting-line-split-empty">Cash/Tickets not reported</span>
                  )}
                </div>
                <div className="betting-line-edge">
                  <EdgeBar pct={side.edge} />
                  <span className="betting-line-edge-label">Edge</span>
                  <EdgeBadge pct={side.edge} />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Mobile-only: same per-side full-width rows read as one long
          undifferentiated list on a phone with no visual separation
          between markets -- this groups both sides of each market into
          its own bordered card instead (team logos once per card, not
          repeated per side), closer to PFF's own mobile card layout.
          Still shows BOTH sides per market, unlike PFF's mobile view
          (which only shows one side) -- that was a deliberate earlier
          decision for this site, not something this reshuffle should
          quietly drop. */}
      <div className="betting-mobile-only">
        {markets.map((m) => (
          <div className="gl-card" key={m.propType}>
            <div className="gl-card-header">
              <div className="gl-card-teams">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="betting-line-logo" src={teamLogoPath(game.teamA.alias)} alt="" />
                <span>{game.teamA.alias}</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="betting-line-logo" src={teamLogoPath(game.teamB.alias)} alt="" />
                <span>{game.teamB.alias}</span>
              </div>
              <span className="gl-card-market-label">{PROP_TYPE_LABELS[m.propType] ?? m.propType}</span>
            </div>
            {[
              { type: m.sideOneType, odds: m.sideOneOdds, edge: m.sideOneEdgePct, cash: m.sideOneCashPct, tickets: m.sideOneTicketsPct },
              { type: m.sideTwoType, odds: m.sideTwoOdds, edge: m.sideTwoEdgePct, cash: m.sideTwoCashPct, tickets: m.sideTwoTicketsPct },
            ].map((side) => (
              <div className="gl-card-side-row" key={side.type}>
                <div className="gl-card-side-pick">
                  <span className="betting-line-side">
                    {sideLabel(side.type, game)} {formatSideLine(m.propType, m.line, side.type)}
                    <HitCheckmark
                      hit={didSideHit(m.propType, side.type, m.line, m.actualHomeScore, m.actualAwayScore)}
                      title="This side hit"
                    />
                  </span>
                  <span className="betting-line-odds">{formatOdds(side.odds)}</span>
                </div>
                <div className="gl-card-side-edge">
                  <EdgeBar pct={side.edge} />
                  <EdgeBadge pct={side.edge} />
                </div>
                <div className="gl-card-side-split">
                  {side.cash != null && side.tickets != null ? (
                    <>
                      {side.cash}% Cash · {side.tickets}% Tickets
                    </>
                  ) : (
                    <span className="betting-line-split-empty">Cash/Tickets not reported</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// Verbatim from PFF's own glossary for this page
// (data/raw/pff/first-touchdown/FirstTDFinder_info.txt, manually
// copied alongside the CSV exports -- same "not in the CSV itself"
// situation as the group headers, this is just explanatory text PFF
// shows, not a data field). Keyed by group, not by individual column,
// matching how PFF's own info icons are placed one per group header.
const FIRST_TD_GROUP_INFO: Record<string, string> = {
  epa: "EPA per play in the first 15 plays measures how efficient offenses are early in games. Can be valuable to compare when deciding what team is more likely to score first.",
  targets:
    "Targets and touches in the first 15 plays indicate how involved an offensive player is early in games, where first touchdowns typically occur.",
  redZone:
    "First half red zone carries and targets represent more valuable scoring opportunities early in games, where a first TD typically occurs.",
  defRedZone:
    "The percentage of drives where a defense allows a TD when the opposing offense gets to the red zone. Higher percentage is better for the offensive player.",
};

// Rendered via a portal to document.body, positioned with fixed
// coordinates from the icon's own bounding rect -- NOT a plain
// absolute-positioned tooltip, because the table it lives in sits
// inside a horizontally-scrolling wrapper (.betting-table-wrap,
// overflow-x: auto). Per the CSS overflow spec, setting overflow-x to
// anything but visible forces the computed overflow-y to auto too, so
// a tooltip positioned relative to an ancestor inside that wrapper
// would get clipped at the wrapper's own edge instead of floating
// above the page -- confirmed this is exactly the kind of bug that
// class of implementation hits.
function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  function toggle() {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const popoverWidth = 260;
      setPos({
        top: rect.bottom + 6,
        left: Math.max(12, Math.min(rect.left, window.innerWidth - popoverWidth - 12)),
      });
    }
    setOpen((o) => !o);
  }

  return (
    <span className="betting-info-wrap">
      <button
        type="button"
        ref={buttonRef}
        className="betting-info-icon"
        aria-label="More info"
        onClick={toggle}
      >
        i
      </button>
      {open &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div className="betting-info-backdrop" onClick={() => setOpen(false)} />
            <div className="betting-info-popover" style={{ top: pos.top, left: pos.left }}>
              {text}
            </div>
          </>,
          document.body
        )}
    </span>
  );
}

function FirstTouchdownSection({ game }: { game: GameStat }) {
  const entries = game.bettingEdge?.firstTouchdown ?? [];
  if (entries.length === 0) return null;

  return (
    <div className="stat-section">
      <h2>First Touchdown</h2>
      <p className="stat-sub">
        Anytime-first-scorer odds alongside the usage signals behind them — touch share, red-zone looks, and how
        often the opponent&apos;s defense has allowed a touchdown at that position.
      </p>
      {/* Outer wrapper + fade div: the table genuinely doesn't fit most
          screens (11 data columns) and needs to scroll horizontally --
          without a visible cue for that, a scrolled-off column reads as
          missing data rather than "scroll right." The fade is pinned to
          the OUTER (non-scrolling) container, not the inner scrolling
          one, so it stays visible at the true right edge regardless of
          scroll position, rather than scrolling away with the content. */}
      <div className="betting-table-outer betting-desktop-only">
      <div className="betting-table-wrap">
        <table className="betting-table betting-table-grouped">
          <thead>
            {/* Same two-row grouped-header shape as PFF's own "First TD
                Finder" -- 11 numeric columns is too many to read as one
                flat header row, so they're clustered under the same 4
                category labels PFF uses. Player/Odds/Book span both
                header rows since they don't belong to any group. */}
            <tr>
              <th rowSpan={2} className="betting-table-sticky-col">
                Player
              </th>
              <th rowSpan={2}>First TD Odds</th>
              <th colSpan={3} className="betting-table-group">
                EPA First 15 Plays <InfoTooltip text={FIRST_TD_GROUP_INFO.epa} />
              </th>
              <th colSpan={3} className="betting-table-group">
                First 15 — Targets, Touches <InfoTooltip text={FIRST_TD_GROUP_INFO.targets} />
              </th>
              <th colSpan={2} className="betting-table-group">
                Red Zone <InfoTooltip text={FIRST_TD_GROUP_INFO.redZone} />
              </th>
              <th colSpan={1} className="betting-table-group">
                Def Redzone <InfoTooltip text={FIRST_TD_GROUP_INFO.defRedZone} />
              </th>
              <th rowSpan={2}>Book</th>
            </tr>
            <tr>
              <th>EPA/Play</th>
              <th>Opp Off EPA/Play</th>
              <th>Diff</th>
              <th>Touches</th>
              <th>Touch Rate</th>
              <th>Adj Target Rate</th>
              <th>Carries</th>
              <th>Tgts</th>
              <th>TD Rate Allowed</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.playerName}>
                <td className="betting-table-sticky-col">
                  <span className="betting-player-team">{e.playerTeam}</span> {e.playerName}
                  {e.position && <span className="betting-player-position">({e.position})</span>}
                  <HitCheckmark hit={e.isActualFirstScorer} title="First TD scorer" />
                </td>
                <td>{formatOdds(e.firstTdOdds)}</td>
                <td style={epaCellStyle(e.epaPerPlay, "high", 0.5)}>
                  {e.epaPerPlay != null ? e.epaPerPlay.toFixed(3) : "—"}
                </td>
                <td style={epaCellStyle(e.oppOffEpaPerPlay, "low", 0.5)}>
                  {e.oppOffEpaPerPlay != null ? e.oppOffEpaPerPlay.toFixed(3) : "—"}
                </td>
                <td style={epaCellStyle(e.epaDifference, "high", 0.8)}>
                  {e.epaDifference != null ? e.epaDifference.toFixed(3) : "—"}
                </td>
                <td>{e.touches ?? "—"}</td>
                <td>{e.touchRatePct != null ? `${e.touchRatePct}%` : "—"}</td>
                <td>{e.adjTargetRatePct != null ? `${e.adjTargetRatePct}%` : "—"}</td>
                <td>{e.redZoneCarries ?? 0}</td>
                <td>{e.redZoneTargets ?? 0}</td>
                <td>{e.tdRateAllowedPct != null ? `${e.tdRateAllowedPct}%` : "—"}</td>
                <td>
                  <SportsbookLink sportsbook={e.sportsbook} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="betting-table-fade" aria-hidden="true" />
      </div>

      {/* Mobile-only: same reasoning as Player Props' mobile cards --
          this table's 11 columns don't shrink into something usable on
          a phone, so this is a second, independent rendering of the
          same `entries` as cards, toggled purely by CSS against the
          table above. */}
      <div className="betting-mobile-only">
        {entries.map((e) => (
          <TdCard key={e.playerName} entry={e} game={game} />
        ))}
      </div>
    </div>
  );
}

function TdCard({ entry: e, game }: { entry: FirstTouchdownEntry; game: GameStat }) {
  const isHome = e.playerTeam === game.teamB.alias;

  return (
    <div className="td-card">
      <div className="td-card-top">
        <PlayerHeadshot espnId={e.espnId} alias={e.playerTeam} size={44} />
        <div className="td-card-name-wrap">
          <div className="td-card-name">
            {e.playerName}
            {e.position && <span className="betting-player-position">({e.position})</span>}
            <HitCheckmark hit={e.isActualFirstScorer} title="First TD scorer" />
          </div>
          <div className="td-card-matchup">
            <span className="betting-player-team">{e.playerTeam}</span>
            {isHome ? "vs" : "@"} {e.opponentTeam}
          </div>
        </div>
        <div className="td-card-odds-wrap">
          <span className="td-card-odds">{formatOdds(e.firstTdOdds)}</span>
          <SportsbookLink sportsbook={e.sportsbook} />
        </div>
      </div>
      <div className="td-card-stats-row">
        <div className="td-card-stat-box">
          <div className="prop-card-stat-label">Touch Rate</div>
          <div className="prop-card-stat-value">{e.touchRatePct != null ? `${e.touchRatePct}%` : "—"}</div>
        </div>
        <div className="td-card-stat-box">
          <div className="prop-card-stat-label">Red Zone</div>
          <div className="prop-card-stat-value">
            {e.redZoneCarries ?? 0}c / {e.redZoneTargets ?? 0}t
          </div>
        </div>
        <div className="td-card-stat-box">
          <div className="prop-card-stat-label">Opp TD Rate</div>
          <div className="prop-card-stat-value">{e.tdRateAllowedPct != null ? `${e.tdRateAllowedPct}%` : "—"}</div>
        </div>
      </div>
      <div className="td-card-epa-row">
        <div className="td-card-epa-box" style={epaCellStyle(e.epaPerPlay, "high", 0.5)}>
          <div className="prop-card-stat-label">EPA/Play</div>
          <div className="prop-card-stat-value">{e.epaPerPlay != null ? e.epaPerPlay.toFixed(3) : "—"}</div>
        </div>
        <div className="td-card-epa-box" style={epaCellStyle(e.oppOffEpaPerPlay, "low", 0.5)}>
          <div className="prop-card-stat-label">Opp Off EPA</div>
          <div className="prop-card-stat-value">
            {e.oppOffEpaPerPlay != null ? e.oppOffEpaPerPlay.toFixed(3) : "—"}
          </div>
        </div>
        <div className="td-card-epa-box" style={epaCellStyle(e.epaDifference, "high", 0.8)}>
          <div className="prop-card-stat-label">Diff</div>
          <div className="prop-card-stat-value">{e.epaDifference != null ? e.epaDifference.toFixed(3) : "—"}</div>
        </div>
      </div>
    </div>
  );
}

function KeyInsightsSection({ game }: { game: GameStat }) {
  const entries = game.bettingEdge?.keyInsights ?? [];
  if (entries.length === 0) return null;

  return (
    <div className="stat-section">
      <h2>Key Insights</h2>
      <p className="stat-sub">Matchup-specific notes for players in this game.</p>
      <div className="betting-insights-grid">
        {entries.map((e, i) => (
          <div className="betting-insight-card" key={`${e.playerName}-${i}`}>
            {e.headshotUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="betting-insight-headshot" src={e.headshotUrl} alt="" />
            )}
            <div className="betting-insight-body">
              <div className="betting-insight-player">
                {e.playerName} <span className="betting-player-team">{e.playerTeam}</span>
              </div>
              <div className="betting-insight-headline">{e.insightHeadline}</div>
              <div className="betting-insight-detail">{e.insightDetail}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MatchupGradeBadge({ grade }: { grade: string | null }) {
  if (!grade) return null;
  const cls =
    grade === "GOOD" ? "betting-grade-good" : grade === "POOR" ? "betting-grade-poor" : "betting-grade-fair";
  return <span className={`betting-grade-badge ${cls}`}>{grade}</span>;
}

// Same idea as epaCellStyle (fixed bounds, not scraped) applied to a
// "X/Y" hit-rate record instead of a raw number. "0/0" (no sample
// yet) is deliberately left uncolored -- there's nothing to grade.
function hitRateCellStyle(record: string | null): CSSProperties {
  if (!record) return {};
  const match = record.match(/^(\d+)\/(\d+)$/);
  if (!match) return {};
  const hits = Number(match[1]);
  const total = Number(match[2]);
  if (total === 0) return {};
  const rate = hits / total;
  const alpha = 0.16;
  if (rate >= 0.6) return { backgroundColor: `rgba(57, 217, 138, ${alpha})` };
  if (rate >= 0.4) return { backgroundColor: `rgba(255, 214, 10, ${alpha})` };
  return { backgroundColor: `rgba(255, 107, 107, ${alpha})` };
}

function HitRateCell({ record, hitType }: { record: string | null; hitType: string | null }) {
  return (
    <td style={hitRateCellStyle(record)}>
      {record ?? "—"}
      {hitType && <div className="betting-hit-type">{hitType}</div>}
    </td>
  );
}

function PlayerPropsSection({ game }: { game: GameStat }) {
  const entries = game.bettingEdge?.playerProps ?? [];
  if (entries.length === 0) return null;

  // Graded entries only -- most props on this site are for games that
  // haven't been played yet, where pickResult is still null. Nothing
  // to summarize until at least one prop has an actual result.
  const graded = entries.filter((e) => e.pickResult === "correct" || e.pickResult === "incorrect");
  const correctCount = graded.filter((e) => e.pickResult === "correct").length;
  const correctPct = graded.length > 0 ? Math.round((correctCount / graded.length) * 100) : null;

  return (
    <div className="stat-section">
      <h2>Player Props</h2>
      <p className="stat-sub">
        Prop picks for this game, sorted by pRank (our model&apos;s rank of how likely each pick is to hit) —
        the consensus line, the recommended side, its projection, matchup context, and recent hit-rate form for
        each player prop.
      </p>
      {graded.length > 0 && (
        <p className="betting-props-summary">
          <span className="betting-props-summary-correct">{correctCount}</span>
          <span className="betting-props-summary-sep">/</span>
          <span className="betting-props-summary-total">{graded.length}</span>
          <span className="betting-props-summary-pct">{correctPct}% correct</span>
        </p>
      )}
      <div className="betting-table-outer betting-desktop-only">
      <div className="betting-table-wrap">
        <table className="betting-table betting-table-grouped">
          <thead>
            <tr>
              <th rowSpan={2} className="betting-table-sticky-col">
                pRank <InfoTooltip text={PLAYER_PROP_COLUMN_INFO.pRank} />
              </th>
              <th rowSpan={2}>
                Player <InfoTooltip text={PLAYER_PROP_COLUMN_INFO.player} />
              </th>
              <th rowSpan={2}>
                Consensus <InfoTooltip text={PLAYER_PROP_COLUMN_INFO.consensus} />
              </th>
              <th rowSpan={2}>
                Pick <InfoTooltip text={PLAYER_PROP_COLUMN_INFO.pick} />
              </th>
              <th colSpan={4} className="betting-table-group">
                Projections + Value
              </th>
              <th colSpan={2} className="betting-table-group">
                PFF Insights and Data
              </th>
              <th colSpan={4} className="betting-table-group">
                Hit Rates
              </th>
            </tr>
            <tr>
              <th>
                Proj <InfoTooltip text={PLAYER_PROP_COLUMN_INFO.proj} />
              </th>
              <th>
                L10 Avg <InfoTooltip text={PLAYER_PROP_COLUMN_INFO.l10Avg} />
              </th>
              <th>
                Cov Prob <InfoTooltip text={PLAYER_PROP_COLUMN_INFO.covProb} />
              </th>
              <th>
                Edge <InfoTooltip text={EDGE_INFO_PLAYER_PROPS} />
              </th>
              <th>
                Def vs Prop <InfoTooltip text={PLAYER_PROP_COLUMN_INFO.defVsProp} />
              </th>
              <th>
                Matchup <InfoTooltip text={PLAYER_PROP_COLUMN_INFO.matchup} />
              </th>
              <th>
                Sim Def <InfoTooltip text={PLAYER_PROP_COLUMN_INFO.simDef} />
              </th>
              <th>
                L5 <InfoTooltip text={PLAYER_PROP_COLUMN_INFO.l5} />
              </th>
              <th>
                L10 <InfoTooltip text={PLAYER_PROP_COLUMN_INFO.l10} />
              </th>
              <th>
                H2H <InfoTooltip text={PLAYER_PROP_COLUMN_INFO.h2h} />
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={`${e.playerName}-${e.consensusStat}`}>
                <td className="betting-table-sticky-col betting-prank-cell">
                  {e.pRank != null ? e.pRank : "—"}
                  {e.overallRank != null && (
                    <span className="betting-prank-overall">({e.overallRank})</span>
                  )}
                </td>
                <td>
                  <span className="betting-player-team">{e.playerTeam}</span> {e.playerName}
                  {displayPosition(e) && <span className="betting-player-position">({displayPosition(e)})</span>}
                  <PickResultIcon result={e.pickResult} />
                </td>
                <td>
                  {e.consensusLine ?? "—"} {e.consensusStat}
                </td>
                <td>
                  <div className="betting-pick-cell">
                    {e.pickSportsbook && <SportsbookLink sportsbook={e.pickSportsbook} />}
                    <span>
                      {e.pickSide ?? ""} {e.pickLine ?? ""}
                      {e.pickOdds != null && (
                        <>
                          <br />
                          <span className="betting-player-team">{formatOdds(e.pickOdds)}</span>
                        </>
                      )}
                    </span>
                  </div>
                </td>
                <td className={e.projDirection === "Under" ? "betting-proj-under" : "betting-proj-over"}>
                  {e.projValue ?? "—"}
                  {e.projDirection && <div className="betting-hit-type">{e.projDirection}</div>}
                </td>
                <td>{e.l10Avg ?? "—"}</td>
                <td>{e.covProbPct != null ? `${e.covProbPct}%` : "—"}</td>
                <td>{e.edgePct != null ? <EdgeBadge pct={e.edgePct} /> : "—"}</td>
                <td>
                  {e.defVsPropRank && e.defVsPropRank !== "-" ? e.defVsPropRank : "—"}
                  {e.matchupPosition && <div className="betting-hit-type">{e.matchupPosition} vs Prop</div>}
                </td>
                <td>
                  <MatchupGradeBadge grade={e.matchupGrade} />
                  {e.matchupPosition && <div className="betting-hit-type">{e.matchupPosition} vs Def</div>}
                </td>
                <HitRateCell record={e.simDefRecord} hitType={e.simDefHitType} />
                <HitRateCell record={e.l5Record} hitType={e.l5HitType} />
                <HitRateCell record={e.l10Record} hitType={e.l10HitType} />
                <HitRateCell record={e.h2hRecord} hitType={e.h2hHitType} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="betting-table-fade" aria-hidden="true" />
      </div>

      {/* Mobile-only: the grouped table (13 columns, built for desktop)
          genuinely doesn't work as a shrunk-down table on a phone --
          this is a second, independent rendering of the same `entries`
          data as cards, matching PFF's own mobile Player Prop Tool
          layout, toggled against the table above purely by CSS
          min-width (see .betting-desktop-only/-mobile-only) so
          there's no client-side layout-detection logic needed. */}
      <div className="betting-mobile-only">
        {entries.map((e) => (
          <PropCard key={`${e.playerName}-${e.consensusStat}`} entry={e} game={game} />
        ))}
      </div>
    </div>
  );
}

function PropCard({ entry: e, game }: { entry: PlayerPropEntry; game: GameStat }) {
  const isHome = e.playerTeam === game.teamB.alias;

  return (
    <div className="prop-card">
      <div className="prop-card-top">
        <span className="prop-card-stat">{e.consensusStat}</span>
        <div className="prop-card-pick">
          {e.pRank != null && (
            <span className="prop-card-prank">
              {e.pRank}
              {e.overallRank != null && (
                <span className="betting-prank-overall">({e.overallRank})</span>
              )}
            </span>
          )}
          {e.edgePct != null && <EdgeBadge pct={e.edgePct} />}
          <span className="prop-card-line">
            {e.pickSide ?? ""} {e.pickLine ?? ""}
          </span>
          {e.pickSportsbook && <SportsbookLink sportsbook={e.pickSportsbook} />}
        </div>
      </div>
      <div className="prop-card-body">
        <div className="prop-card-player">
          <PlayerHeadshot espnId={e.espnId} alias={e.playerTeam} size={48} />
          <div>
            <div className="prop-card-name">
              {e.playerName}
              {displayPosition(e) && <span className="betting-player-position">({displayPosition(e)})</span>}
              <PickResultIcon result={e.pickResult} />
            </div>
            <div className="prop-card-matchup">
              <span className="betting-player-team">{e.playerTeam}</span>
              {isHome ? "vs" : "@"} {e.opponentTeam}
            </div>
          </div>
        </div>
        <div className="prop-card-proj">
          <div className="prop-card-proj-value">
            {e.projValue ?? "—"}
            <span className="prop-card-proj-label">PROJ</span>
          </div>
          {e.l10Avg != null && <div className="prop-card-avg">AVG: {e.l10Avg}</div>}
        </div>
      </div>
      <div className="prop-card-stats-row">
        <div className="prop-card-stat-box">
          <div className="prop-card-stat-label">{e.matchupPosition ?? ""} Matchup</div>
          <MatchupGradeBadge grade={e.matchupGrade} />
        </div>
        <div className="prop-card-stat-box">
          <div className="prop-card-stat-label">Cover Prob</div>
          <div className="prop-card-stat-value">{e.covProbPct != null ? `${e.covProbPct}%` : "—"}</div>
        </div>
        <div className="prop-card-stat-box">
          <div className="prop-card-stat-label">{e.pickSide ?? ""} Hit Rate</div>
          <div className="prop-card-stat-value">{e.l10Record ?? "—"}</div>
        </div>
      </div>
    </div>
  );
}

function BettingEdgeView({ game }: { game: GameStat }) {
  if (!game.bettingEdge) {
    return (
      <div className="stat-section">
        <h2>Betting Edge</h2>
        <div className="lineup-unavailable">Betting data isn&apos;t available for this game yet.</div>
      </div>
    );
  }

  return (
    <>
      <GameLinesSection game={game} />
      <FirstTouchdownSection game={game} />
      <KeyInsightsSection game={game} />
      <PlayerPropsSection game={game} />
    </>
  );
}

function formatPercent(p: number): string {
  return `${(p * 100).toFixed(1)}%`;
}

function parlayLegLabel(e: PlayerPropEntry): string {
  if (e.consensusStat === "Anytime TD") return "Anytime TD";
  return `${e.pickSide ?? ""} ${e.pickLine ?? ""} ${e.consensusStat}`.trim();
}

// What the player actually did, once the game is final -- null pre-game
// (see PlayerPropEntry.actualValue's own comment). "Anytime TD" stores
// actualValue as 1/0, not a yardage-style number, so it gets its own
// phrasing instead of "actual 1 Anytime TD".
function parlayLegActualLabel(e: PlayerPropEntry): string | null {
  if (e.actualValue === null) return null;
  if (e.consensusStat === "Anytime TD") return e.actualValue > 0 ? "actual: scored a TD" : "actual: no TD";
  return `actual ${e.actualValue} ${e.consensusStat}`;
}

// Hit only when every leg is graded correct, missed as soon as any leg
// is graded incorrect, otherwise still pending (game not final yet).
function parlayOutcome(parlay: Parlay): "hit" | "missed" | null {
  if (parlay.legs.some((l) => l.entry.pickResult === "incorrect")) return "missed";
  if (parlay.legs.every((l) => l.entry.pickResult === "correct")) return "hit";
  return null;
}

function sportsbookName(key: string): string {
  return SPORTSBOOK_INFO[key]?.name ?? key;
}

function ParlayCard({ title, parlay }: { title: string; parlay: Parlay }) {
  const outcome = parlayOutcome(parlay);
  return (
    <div className={`parlay-card${outcome ? ` parlay-card-${outcome}` : ""}`}>
      <div className="parlay-card-head">
        <div className="parlay-card-titles">
          <span className="parlay-card-title">
            {title}
            {outcome && (
              <span className={`parlay-outcome parlay-outcome-${outcome}`}>{outcome === "hit" ? "Hit" : "Missed"}</span>
            )}
          </span>
          <span className="parlay-card-book">
            {parlay.sportsbook ? (
              <>
                <SportsbookLink sportsbook={parlay.sportsbook} />
                All legs at {sportsbookName(parlay.sportsbook)}
              </>
            ) : (
              "Legs are at different books"
            )}
          </span>
        </div>
        <div className="parlay-card-stats">
          <div className="parlay-stat">
            <span className="parlay-stat-value">{formatPercent(parlay.probability)}</span>
            <span className="parlay-stat-label">chance to hit</span>
          </div>
          <div className="parlay-stat">
            <span className="parlay-stat-value parlay-stat-payout">${parlay.decimalOdds.toFixed(2)}</span>
            <span className="parlay-stat-label">payout on a $1 bet</span>
            <span className="parlay-stat-sub">(${(parlay.decimalOdds - 1).toFixed(2)} profit)</span>
          </div>
        </div>
      </div>
      <ul className="parlay-legs">
        {parlay.legs.map((leg) => {
          const e = leg.entry;
          const actualLabel = parlayLegActualLabel(e);
          return (
            <li key={`${e.playerName}-${e.consensusStat}`} className="parlay-leg">
              <span className="parlay-leg-rank" title="Rank within this game">
                {e.pRank}
              </span>
              <div className="parlay-leg-main">
                <div className="parlay-leg-player">
                  <span className="betting-player-team">{e.playerTeam}</span> {e.playerName}
                  {displayPosition(e) && <span className="betting-player-position">({displayPosition(e)})</span>}
                  <PickResultIcon result={e.pickResult} />
                </div>
                <div className="parlay-leg-pick">{parlayLegLabel(e)}</div>
                {actualLabel && <div className="parlay-leg-actual">{actualLabel}</div>}
              </div>
              <div className="parlay-leg-odds">
                {leg.sportsbook && <SportsbookLink sportsbook={leg.sportsbook} />}
                <span>{formatOdds(leg.odds)}</span>
              </div>
              <div className="parlay-leg-prob">{formatPercent(leg.probability)}</div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ParlayHelperView({ game }: { game: GameStat }) {
  // Mixed-book mode is hidden, not removed -- with this many books now
  // covering a game's props (see pffBettingEdge.ts's matchingLine* line-
  // shopping), a single-book parlay is almost always findable, so the
  // toggle just added confusion without much upside. parlays.mixed is
  // still built and logged server-side exactly like parlays.single (see
  // getGameBettingEdge/recordDisplayedParlays) in case this comes back.
  const mixedBooks = false;
  // Built and logged on the server (getGameBettingEdge) so what's shown is
  // exactly what's recorded in public.site_parlay_log.
  const parlays = game.bettingEdge?.parlays;
  const { twoLeg, threeLeg } = (mixedBooks ? parlays?.mixed : parlays?.single) ?? { twoLeg: [], threeLeg: null };

  if (!parlays || parlays.mixed.twoLeg.length === 0) {
    return (
      <div className="stat-section">
        <h2>Parlay Helper</h2>
        <div className="lineup-unavailable">Parlay suggestions aren&apos;t available for this game yet.</div>
      </div>
    );
  }

  return (
    <div className="stat-section">
      <h2>Parlay Helper</h2>
      <p className="stat-sub">
        Same-game parlays built from this game&apos;s top {PARLAY_POOL_SIZE} player props by pRank, using our model&apos;s
        estimate of how likely each pick is to hit based on historical results. One leg per player.
      </p>

      <div className="parlay-notice" role="note">
        <p>
          <strong>Play responsibly.</strong> Gambling carries real risk, and parlays are long shots that lose far more
          often than they win. Only bet what you can afford to lose, set limits, and treat any winnings as a bonus. If
          gambling stops being fun, call or text 1-800-GAMBLER. You must be of legal betting age where you live.
        </p>
        <p>
          <strong>Use these as a starting point, not a guarantee.</strong> These are the strongest combinations we can
          build from this game&apos;s props, but every leg in a parlay has to be offered by the same sportsbook, and a
          book may not offer a given leg or may price the combination differently. So by default each parlay below uses
          legs from a single book you can place as one slip. Check that your book offers every leg, at these lines,
          before you bet.
        </p>
      </div>

      {twoLeg.length === 0 ? (
        <div className="lineup-unavailable">No parlay with every leg at one sportsbook for this game.</div>
      ) : (
        <div className="parlay-grid">
          {twoLeg.map((parlay, i) => (
            <ParlayCard key={i} title={`2-Leg Parlay ${i + 1}`} parlay={parlay} />
          ))}
          {threeLeg && <ParlayCard title="3-Leg Parlay" parlay={threeLeg} />}
        </div>
      )}
      {twoLeg.length > 0 && !threeLeg && (
        <p className="parlay-note">
          No 3-leg parlay for this game: fewer than three players{mixedBooks ? "" : " at a single sportsbook"} have a
          prop rated at least {Math.round(MIN_THREE_LEG_LEG_PROBABILITY * 100)}% likely to hit.
        </p>
      )}
      <p className="parlay-note">
        Chance to hit multiplies each leg&apos;s probability and assumes the legs are independent. Payout is the total
        returned on a $1 bet, including your $1 stake, estimated from each leg&apos;s listed odds; sportsbooks price
        same-game parlays themselves, so the real payout is usually lower.
      </p>
    </div>
  );
}

type PageTab = "overview" | "matchups" | "bettingEdge" | "parlayHelper";

function PageTabStrip({
  active,
  onChange,
}: {
  active: PageTab;
  onChange: (tab: PageTab) => void;
}) {
  return (
    <div className="page-tab-strip" role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={active === "overview"}
        className={active === "overview" ? "active" : ""}
        onClick={() => onChange("overview")}
      >
        Overview
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={active === "matchups"}
        className={active === "matchups" ? "active" : ""}
        onClick={() => onChange("matchups")}
      >
        Matchups
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={active === "bettingEdge"}
        className={active === "bettingEdge" ? "active" : ""}
        onClick={() => onChange("bettingEdge")}
      >
        Betting Edge
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={active === "parlayHelper"}
        className={active === "parlayHelper" ? "active" : ""}
        onClick={() => onChange("parlayHelper")}
      >
        Parlay Helper
      </button>
    </div>
  );
}

const INJURY_STATUS_CLASS: Record<string, string> = {
  Out: "injury-out",
  Doubtful: "injury-doubtful",
  Questionable: "injury-questionable",
};

function InjuryColumn({ alias, entries }: { alias: string; entries: InjuryEntry[] }) {
  return (
    <div className="injury-column">
      <div className="injury-column-title">{alias}</div>
      {entries.length === 0 ? (
        <div className="injury-empty">Nothing on the report.</div>
      ) : (
        <ul className="injury-list">
          {entries.map((entry) => (
            <li className={`injury-row ${entry.position === "QB" ? "injury-row-qb" : ""}`} key={entry.player}>
              <span className="injury-player">
                {entry.position && <span className="injury-position">{entry.position}</span>}
                {entry.player}
              </span>
              <span className={`injury-status ${INJURY_STATUS_CLASS[entry.status] ?? "injury-status-mild"}`}>
                {entry.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Context only, never a claimed cause -- this project already tested
// injury data as a predictive feature (a 12-fold rolling backtest)
// and found no measurable improvement over the market-line model, so
// nothing here should be read as "why" a game went a certain way, just
// who was banged up going in. QBs sort first within each column (see
// injuries.ts's sortEntries) since that's the one line most readers
// actually scan for.
function InjuryReportSection({ game }: { game: GameStat }) {
  if (!game.injuryReport) return null;

  return (
    <div className="stat-section">
      <h2>Injury Report</h2>
      <p className="stat-sub">The latest official designations and practice participation for both teams.</p>
      <div className="injury-grid">
        <InjuryColumn alias={game.teamA.alias} entries={game.injuryReport.away} />
        <InjuryColumn alias={game.teamB.alias} entries={game.injuryReport.home} />
      </div>
    </div>
  );
}

function ResultCompare({ game }: { game: GameStat }) {
  if (!game.finalResult) return null;
  const favored = game[game.favored];
  const winnerName = teamDisplay(game.finalResult.winnerAlias);

  return (
    <div className="stat-section">
      <h2>Prediction vs. Result</h2>
      <p className="stat-sub">We keep every prediction permanently so we can always show our work.</p>
      <div className="result-compare">
        <div className="compare-card">
          <div className="label">PREGAME WIN PROBABILITY</div>
          <div className="value">
            {teamDisplay(favored.alias).split(" ").pop()} {favored.winProb}%
          </div>
        </div>
        <div
          className={`compare-card ${
            game.predictionCorrect === true ? "hit" : game.predictionCorrect === false ? "miss" : ""
          }`}
        >
          <div className="label">ACTUAL RESULT</div>
          <div className="value">
            {winnerName} won by {game.finalResult.margin}
          </div>
        </div>
        <div className="compare-card">
          <div className="label">COMBINED SCORE</div>
          <div className="value">{game.finalResult.totalScore}</div>
        </div>
      </div>
    </div>
  );
}

// The AI-drafted recap, when one's been published for this game --
// only ever rendered for a final game (see page.tsx, which only
// looks one up once game.finalResult exists). Full 250-300 word body,
// not a truncated teaser -- the teaser version lives on the home page
// (see page.tsx's article-grid, which truncates for that card).
function GameRecap({ story }: { story: Story | null }) {
  if (!story) return null;

  return (
    <div className="stat-section">
      <div className="story-recap">
        <h2>{story.headline}</h2>
        {story.body.split("\n").map((paragraph, i) => (
          <p key={i} className="story-recap-body" style={{ marginTop: i === 0 ? 0 : "1rem" }}>
            {paragraph}
          </p>
        ))}
      </div>
    </div>
  );
}

export default function GameDetailView({ game, story = null }: { game: GameStat; story?: Story | null }) {
  const { isMember, toggle } = useMemberPreview();
  const router = useRouter();
  const locked = !game.premier && !isMember;
  const [activeTab, setActiveTab] = useState<PageTab>("overview");

  useEffect(() => {
    if (game.status !== "live") return;
    const interval = setInterval(() => router.refresh(), LIVE_REFRESH_MS);
    return () => clearInterval(interval);
  }, [game.status, router]);

  return (
    <>
      {/* Wrapped so .game-sticky-bar's `position: sticky` range is
          scoped to this above-the-tabs block instead of the whole
          rest of the page (its own containing block, absent this
          wrapper, would be the page layout's root element) -- it
          unsticks once this block scrolls past, right before the tab
          strip, instead of staying pinned at z-index 20 over the tabs
          (and whichever tab content sits at the top of the viewport)
          for the rest of the scroll and silently eating their taps. */}
      <div>
        <StickyBar game={game} />

        <div className="content-split">
        <aside className="promo-rail promo-rail-left" aria-label="Promotional space">
          <AdFrame>
            <AdUnit kind="rail" />
            <span className="slot-label">Ad space</span>
          </AdFrame>
          <AdFrame>
            <AdUnit kind="rail" />
            <span className="slot-label">Ad space</span>
          </AdFrame>
        </aside>

        <main className="content-main">
          <Link href="/home" style={{ display: "inline-block", marginBottom: "1.5rem", color: "var(--text-dim)" }}>
            &larr; back to predictions
          </Link>

          <Hero game={game} />

          <div className="mobile-ad-wrap" aria-label="Promotional space">
            <MobileAdFrame>
              <AdUnit kind="mobile" />
              <span className="slot-label">Ad space</span>
            </MobileAdFrame>
          </div>

          {locked ? (
            <>
              {/* The written recap and the basic prediction-vs-result
                  comparison are NOT part of what the paywall below
                  claims to protect -- its own copy only names
                  "margin-of-victory breakdowns and total-score
                  probabilities" (MarginSection/TotalsSection). Gating
                  the recap too meant every /game/[id] link from
                  /stories or the home page (or a Google crawler,
                  which is never signed in) landed on a paywall with
                  no actual article behind it for any game except the
                  one free premier pick each week -- real content that
                  existed in the database but was unreachable by
                  anyone who hadn't already signed up. Edge/injury
                  context is the same kind of free editorial content,
                  not a quantified model output, so it stays out of
                  the lock for the same reason. */}
              <InjuryReportSection game={game} />
              <ResultCompare game={game} />
              <GameRecap story={story} />
              <div className="mobile-ad-wrap" aria-label="Promotional space">
                <MobileAdFrame>
                  <AdUnit kind="mobile" />
                  <span className="slot-label">Ad space</span>
                </MobileAdFrame>
              </div>
              <div className="locked-section is-locked">
                <div className="matchup-grid">
                  <MarginSection game={game} />
                  <TotalsSection game={game} />
                </div>
                <div className="unlock-panel">
                  <div className="unlock-card">
                    <span className="lock-icon">🔒</span>
                    <h3>Unlock Full Game Stats</h3>
                    <p>
                      Margin-of-victory breakdowns and total-score probabilities for every game are a free-account
                      feature. This one&apos;s part of the paid slate — the Game of the Week is always free to view
                      in full.
                    </p>
                    <Link className="btn btn-primary btn-block" href="/signup">
                      Sign Up Free
                    </Link>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <InjuryReportSection game={game} />
              <ResultCompare game={game} />
              <GameRecap story={story} />
              <div className="mobile-ad-wrap" aria-label="Promotional space">
                <MobileAdFrame>
                  <AdUnit kind="mobile" />
                  <span className="slot-label">Ad space</span>
                </MobileAdFrame>
              </div>
              <MarginSection game={game} />
              <TotalsSection game={game} />
              <PercentileSection game={game} />
            </>
          )}

          {SHOW_MEMBER_PREVIEW_TOGGLE && (
            <div className="dev-toggle">
              <button type="button" onClick={toggle}>
                testing: toggle member view
              </button>
            </div>
          )}
        </main>

        <aside className="promo-rail promo-rail-right" aria-label="Promotional space">
          <AdFrame>
            <AdUnit kind="rail" />
            <span className="slot-label">Ad space</span>
          </AdFrame>
          <AdFrame>
            <AdUnit kind="rail" />
            <span className="slot-label">Ad space</span>
          </AdFrame>
        </aside>
      </div>

      <footer className="site-footer">
        <p>
          Every number above comes from the model&apos;s live prediction data — 100,000 Monte Carlo simulations,
          grounded in the market line at generation time.
        </p>
      </footer>
      </div>

      {/* Tab strip sits here, right above the PFF report block, rather
          than under the Hero -- everything above this point (margin/
          totals/percentile, the model-data disclaimer) is shared
          context for both tabs, not Overview-only content. */}
      {/* mobile-ad-wrap--pre-tabs: this specific placement needs extra
          reserved clearance below it that the other mobile-ad-wrap
          instances don't -- .mobile-ad-panel is absolutely positioned
          inside .mobile-ad-frame's fixed 7:2-aspect-ratio box (sized
          for the decorative frame, not for ad content), and AdSense's
          "auto" format + full-width-responsive can fill that panel
          with a creative taller than the frame (observed: a ~250px
          rectangle inside an ~87px frame, confirmed live on the
          ltorres-1 deploy -- doesn't reproduce locally since no real
          ad serves there). With no overflow clipping (AdSense policy
          prohibits cropping ads), the overflow spilled ~80px past the
          frame's own box and landed on the tab strip right below it,
          eating every tap -- "Matchups"/"Betting Edge" looked dead on
          mobile. The other two mobile-ad-wrap placements on this page
          have the same underlying overflow quirk but nothing critical
          sits close enough below them for it to matter, so this fix
          is scoped to just this one spot instead of changing the
          shared ad frame's sizing (tuned deliberately, affects every
          ad placement site-wide) for a problem only this spot has. */}
      <div className="mobile-ad-wrap mobile-ad-wrap--pre-tabs" aria-label="Promotional space">
        <MobileAdFrame>
          <AdUnit kind="mobile" />
          <span className="slot-label">Ad space</span>
        </MobileAdFrame>
      </div>

      <PageTabStrip active={activeTab} onChange={setActiveTab} />

      {/* Same free-premier-game-only pattern as MarginSection/TotalsSection
          above -- these three tabs are PFF-backed stats/tools (grades,
          lineup diagrams, betting lines), not editorial content, so
          gating them doesn't reintroduce the AdSense "low value content"
          problem the recap/injury-report unlock above was specifically
          for: the written article stays free on every game regardless of
          this. The tab strip itself stays visible and clickable when
          locked -- blurring the content (not hiding the tabs) is what
          shows a visitor every game has this depth, not just the one
          free pick, same as Margin/Totals' own blur-preview. */}
      {locked ? (
        <div className="locked-section is-locked">
          <div className="matchup-grid">
            {activeTab === "overview" ? (
              <div className="page-edge-section">
                <HighestGradedPlayersSection game={game} />
                <QbMatchupSection game={game} />
                <EfficiencySection game={game} />
                <PressureMatchupSection game={game} />
                <TeamGradesSection game={game} />
              </div>
            ) : activeTab === "matchups" ? (
              <div className="page-edge-section">
                <MatchupsView game={game} />
              </div>
            ) : activeTab === "bettingEdge" ? (
              <div className="page-edge-section">
                <BettingEdgeView game={game} />
              </div>
            ) : (
              <div className="page-edge-section">
                <ParlayHelperView game={game} />
              </div>
            )}
          </div>
          <div className="unlock-panel">
            <div className="unlock-card">
              <span className="lock-icon">🔒</span>
              <h3>Unlock Matchups &amp; Betting Edge</h3>
              <p>
                PFF player grades, lineup matchups, and betting-line insights for every game are a free-account
                feature. This one&apos;s part of the paid slate — the Game of the Week is always free to view in
                full.
              </p>
              <Link className="btn btn-primary btn-block" href="/signup">
                Sign Up Free
              </Link>
            </div>
          </div>
        </div>
      ) : activeTab === "overview" ? (
        // Below the model-data disclaimer on purpose -- these grades
        // come from PFF, a separate data source from the Monte Carlo
        // simulation the footer above is describing, not "every number
        // above." These five sections replicate PFF's own game-report
        // page, in PFF's own order, as one cohesive block. ("Who Has
        // the Edge?", the original cross-unit-matchup section, was
        // removed -- Team Grades below covers the same ground with
        // PFF's own real report shape instead.
        <div className="page-edge-section">
          <HighestGradedPlayersSection game={game} />
          <QbMatchupSection game={game} />
          <EfficiencySection game={game} />
          <PressureMatchupSection game={game} />
          <TeamGradesSection game={game} />
        </div>
      ) : activeTab === "matchups" ? (
        <div className="page-edge-section">
          <MatchupsView game={game} />
        </div>
      ) : activeTab === "bettingEdge" ? (
        <div className="page-edge-section">
          <BettingEdgeView game={game} />
        </div>
      ) : (
        <div className="page-edge-section">
          <ParlayHelperView game={game} />
        </div>
      )}
    </>
  );
}
