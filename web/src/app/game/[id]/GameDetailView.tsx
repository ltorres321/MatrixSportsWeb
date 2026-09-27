"use client";

import { useEffect, useState } from "react";
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
function EdgeValue({ side, alias, align }: { side: EdgeSide | null; alias: string; align: "left" | "right" }) {
  if (!side) {
    return (
      <div className={`edge-value edge-value-${align}`}>
        <span className="edge-value-team">{alias}</span>
        <div className="edge-value-box edge-value-box-empty">—</div>
      </div>
    );
  }
  const tier = gradeTierColor(side.grade);
  return (
    <div className={`edge-value edge-value-${align}`}>
      <span className="edge-value-team">{side.alias}</span>
      <div className="edge-value-box" style={{ borderColor: tier, backgroundColor: `${tier}20` }}>
        {side.grade.toFixed(1)}
      </div>
      <span className="edge-value-rank">
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
  return { alias, grade: stat.value, rankLabel: stat.rank ? `${ordinal(stat.rank)} of ${total}` : `of ${total}` };
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
    <div className="eff-row">
      <span className="eff-row-label">{label}</span>
      <div className="eff-row-value">
        {away ? (
          <>
            <span className="eff-figure">{format(away.value)}</span>
            <span className="eff-rank">{away.rank ? `${ordinal(away.rank)}/32` : ""}</span>
          </>
        ) : (
          <span className="eff-figure eff-figure-missing">—</span>
        )}
      </div>
      <div className="eff-row-value">
        {home ? (
          <>
            <span className="eff-figure">{format(home.value)}</span>
            <span className="eff-rank">{home.rank ? `${ordinal(home.rank)}/32` : ""}</span>
          </>
        ) : (
          <span className="eff-figure eff-figure-missing">—</span>
        )}
      </div>
    </div>
  );
}

function fmtEpa(n: number): string {
  return n.toFixed(2);
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
  return (
    <div className="eff-card">
      <div className="eff-card-title">{title}</div>
      <div className="eff-card-teams">
        <span />
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

function PressureTile({
  title,
  leftLabel,
  leftStat,
  rightLabel,
  rightStat,
}: {
  title: string;
  leftLabel: string;
  leftStat: StatWithRank | null;
  rightLabel: string;
  rightStat: StatWithRank | null;
}) {
  return (
    <div className="pressure-tile">
      <div className="pressure-tile-title">{title}</div>
      <div className="pressure-tile-figures">
        <div className="pressure-figure">
          <span className="pressure-figure-label">{leftLabel}</span>
          <span className="pressure-figure-value">{leftStat ? fmtPct(leftStat.value) : "—"}</span>
          <span className="pressure-figure-rank">{leftStat?.rank ? `${ordinal(leftStat.rank)} of 32` : ""}</span>
        </div>
        <div className="pressure-tile-divider">→</div>
        <div className="pressure-figure">
          <span className="pressure-figure-label">{rightLabel}</span>
          <span className="pressure-figure-value">{rightStat ? fmtPct(rightStat.value) : "—"}</span>
          <span className="pressure-figure-rank">{rightStat?.rank ? `${ordinal(rightStat.rank)} of 32` : ""}</span>
        </div>
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
          title={`When ${awayName} have the ball`}
          leftLabel={`${game.teamA.alias} pressure allowed`}
          leftStat={away.pressureRateAllowed}
          rightLabel={`${game.teamB.alias} pressure generated`}
          rightStat={home.pressureRateGenerated}
        />
        <PressureTile
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
  return (
    <div className="stat-section">
      <h2>Team Grades</h2>
      <p className="stat-sub">Both teams&apos; own season-to-date PFF grades, side by side.</p>
      <div className="team-grades-card">
        {game.teamGrades.map((row) => (
          <div className="edge-row-v2" key={row.label}>
            <EdgeValue side={row.away} alias={row.away.alias} align="left" />
            <div className="edge-row-label">{row.label}</div>
            <EdgeValue side={row.home} alias={row.home.alias} align="right" />
            <EdgeTrack row={{ teamSide: row.away, oppositionSide: row.home }} />
          </div>
        ))}
      </div>
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

  useEffect(() => {
    if (game.status !== "live") return;
    const interval = setInterval(() => router.refresh(), LIVE_REFRESH_MS);
    return () => clearInterval(interval);
  }, [game.status, router]);

  return (
    <>
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

      {/* Below the model-data disclaimer on purpose -- these grades
          come from PFF, a separate data source from the Monte Carlo
          simulation the footer above is describing, not "every number
          above." These five sections replicate PFF's own game-report
          page, in PFF's own order, as one cohesive block. ("Who Has
          the Edge?", the original cross-unit-matchup section, was
          removed -- Team Grades below covers the same ground with
          PFF's own real report shape instead.) */}
      <div className="page-edge-section">
        <HighestGradedPlayersSection game={game} />
        <QbMatchupSection game={game} />
        <EfficiencySection game={game} />
        <PressureMatchupSection game={game} />
        <TeamGradesSection game={game} />
      </div>
    </>
  );
}
