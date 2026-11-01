"use client";

import type { NbaGameDetail } from "@/lib/nbaGameDetail";
import type { TeamFourFactors, FourFactorValue } from "@/lib/nbaFourFactors";
import { teamPrimaryColorNba } from "@/lib/teamColorsNba";

// Replaces the old "Shot Chart" mode in NbaLineupSection.tsx's
// Starters/Second Team/Radar Chart toggle -- see the "Potential
// Features" doc for the design rationale (percentile radar, headline
// ratings above the chart not on it, forward-looking since it's built
// entirely from season-to-date team stats rather than tonight's box
// score). Data comes from lib/nbaFourFactors.ts.

// Same luminance-lift as NbaLineupSection.tsx's own lineupAccentColor
// -- duplicated rather than imported, same "small file-local helper"
// convention that file's own copy of this trick already follows (it
// isn't exported from there either).
function radarAccentColor(alias: string): string {
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

type AxisKey = "efgPct" | "orbPct" | "ftRate" | "tovPct" | "oppEfgPct" | "drbPct" | "oppFtRate" | "forcedTovPct";

interface AxisDef {
  key: AxisKey;
  label: string;
  sub: string;
  get: (t: TeamFourFactors) => FourFactorValue;
  format: (value: number) => string;
}

const pctFmt = (v: number) => (v * 100).toFixed(1);
const ratioFmt = (v: number) => v.toFixed(2);

// Clockwise from the top, matching a standard Four Factors radar --
// offense (shooting/rebounding/FT rate/ball security) on the first
// half-turn, defense (what each team allows) on the second. "Ball
// Security" and "Foul Discipline" are TOV%/opponent FT rate already
// inverted (see nbaFourFactors.ts's LOWER_IS_BETTER) -- their labels
// name the good outcome, not the raw stat, so the percentile plotted
// outward always reads as "better" without the viewer doing the
// inversion in their head.
const AXES: AxisDef[] = [
  { key: "efgPct", label: "Shooting", sub: "eFG% · OFF", get: (t) => t.offense.efgPct, format: pctFmt },
  { key: "orbPct", label: "Off. Rebounding", sub: "ORB% · OFF", get: (t) => t.offense.orbPct, format: pctFmt },
  { key: "ftRate", label: "FT Rate", sub: "FTA/FGA · OFF", get: (t) => t.offense.ftRate, format: ratioFmt },
  { key: "tovPct", label: "Ball Security", sub: "TOV% inv · OFF", get: (t) => t.offense.tovPct, format: pctFmt },
  { key: "oppEfgPct", label: "Opp Shooting", sub: "opp eFG% inv · DEF", get: (t) => t.defense.oppEfgPct, format: pctFmt },
  { key: "drbPct", label: "Def. Rebounding", sub: "DRB% · DEF", get: (t) => t.defense.drbPct, format: pctFmt },
  { key: "oppFtRate", label: "Foul Discipline", sub: "opp FTR inv · DEF", get: (t) => t.defense.oppFtRate, format: ratioFmt },
  { key: "forcedTovPct", label: "Forced Turnovers", sub: "opp TOV% · DEF", get: (t) => t.defense.forcedTovPct, format: pctFmt },
];

const VIEWBOX = 600;
const CENTER = VIEWBOX / 2;
const MAX_RADIUS = 190;
const LABEL_RADIUS = MAX_RADIUS + 46;
const RINGS = [0.25, 0.5, 0.75, 1];

function axisAngle(i: number): number {
  // -90deg (straight up) + i * 45deg, increasing clockwise -- SVG's
  // y-down coordinate system means increasing angle IS clockwise here,
  // no sign flip needed.
  return -Math.PI / 2 + i * ((2 * Math.PI) / AXES.length);
}

function axisPoint(i: number, radiusFraction: number) {
  const angle = axisAngle(i);
  const r = radiusFraction * MAX_RADIUS;
  return { x: CENTER + r * Math.cos(angle), y: CENTER + r * Math.sin(angle) };
}

function labelAnchor(i: number): "start" | "middle" | "end" {
  const cos = Math.cos(axisAngle(i));
  if (cos > 0.3) return "start";
  if (cos < -0.3) return "end";
  return "middle";
}

function polygonPoints(team: TeamFourFactors): string {
  return AXES.map((axis, i) => {
    const p = axisPoint(i, axis.get(team).percentile / 100);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(" ");
}

function HeadlineCard({ name, alias, team }: { name: string; alias: string; team: TeamFourFactors }) {
  return (
    <div className="nba-radar-headline-card" style={{ borderTopColor: radarAccentColor(alias) }}>
      <div className="nba-radar-headline-name" style={{ color: radarAccentColor(alias) }}>
        {name}
      </div>
      <div className="nba-radar-headline-row-item">
        <span>Scores / 100 poss</span>
        <strong>{team.offRtg.toFixed(1)}</strong>
      </div>
      <div className="nba-radar-headline-row-item">
        <span>Allows / 100 poss</span>
        <strong>{team.defRtg.toFixed(1)}</strong>
      </div>
      <div className="nba-radar-headline-row-item">
        <span>Net</span>
        <strong>
          {team.netRtg >= 0 ? "+" : ""}
          {team.netRtg.toFixed(1)}
        </strong>
      </div>
    </div>
  );
}

export default function NbaRadarChart({ game }: { game: NbaGameDetail }) {
  const factors = game.fourFactors;
  if (!factors) {
    return <div className="lineup-field-empty">Four Factors data isn&apos;t available yet.</div>;
  }

  const awayAlias = game.awayTeam;
  const homeAlias = game.homeTeam;
  const awayColor = radarAccentColor(awayAlias);
  const homeColor = radarAccentColor(homeAlias);

  return (
    <div className="nba-radar-wrap">
      <div className="nba-radar-headline-row">
        <HeadlineCard name={game.awayTeamName} alias={awayAlias} team={factors.away} />
        <HeadlineCard name={game.homeTeamName} alias={homeAlias} team={factors.home} />
      </div>
      <p className="nba-radar-pace-line">
        Pace (poss / 48 min): <strong>{factors.away.pace.toFixed(1)}</strong> vs{" "}
        <strong>{factors.home.pace.toFixed(1)}</strong> -- context for totals, not team quality
      </p>

      <div className="nba-radar-chart-wrap">
        <svg
          viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
          width="100%"
          style={{ maxWidth: 560 }}
          role="img"
          aria-label={`Four Factors radar comparing ${game.awayTeamName} and ${game.homeTeamName}`}
        >
          {RINGS.map((f) => (
            <circle
              key={f}
              cx={CENTER}
              cy={CENTER}
              r={f * MAX_RADIUS}
              fill="none"
              stroke="rgba(255,255,255,0.14)"
              strokeWidth={1}
              strokeDasharray={f === 0.5 ? "4 4" : undefined}
            />
          ))}
          {AXES.map((axis, i) => {
            const outer = axisPoint(i, 1);
            return (
              <line
                key={axis.key}
                x1={CENTER}
                y1={CENTER}
                x2={outer.x}
                y2={outer.y}
                stroke="rgba(255,255,255,0.14)"
                strokeWidth={1}
              />
            );
          })}
          <polygon points={polygonPoints(factors.away)} fill={awayColor} fillOpacity={0.32} stroke={awayColor} strokeWidth={2} />
          <polygon points={polygonPoints(factors.home)} fill={homeColor} fillOpacity={0.32} stroke={homeColor} strokeWidth={2} />
          {AXES.map((axis, i) => {
            const anchor = labelAnchor(i);
            const labelPos = axisPoint(i, LABEL_RADIUS / MAX_RADIUS);
            return (
              <text key={axis.key} x={labelPos.x} y={labelPos.y} textAnchor={anchor} className="nba-radar-axis-label">
                <tspan x={labelPos.x} dy="-0.3em" className="nba-radar-axis-label-main">
                  {axis.label}
                </tspan>
                <tspan x={labelPos.x} dy="1.2em" className="nba-radar-axis-label-sub">
                  {axis.sub}
                </tspan>
              </text>
            );
          })}
        </svg>
      </div>

      <div className="nba-radar-legend">
        <span>
          <span className="nba-radar-legend-swatch" style={{ background: awayColor }} />
          {game.awayTeamName}
        </span>
        <span>
          <span className="nba-radar-legend-swatch" style={{ background: homeColor }} />
          {game.homeTeamName}
        </span>
      </div>

      <table className="nba-radar-table">
        <thead>
          <tr>
            <th>Per 100 poss.</th>
            <th style={{ color: awayColor }}>{awayAlias}</th>
            <th style={{ color: homeColor }}>{homeAlias}</th>
          </tr>
        </thead>
        <tbody>
          {AXES.map((axis) => (
            <tr key={axis.key}>
              <td>
                {axis.label} <span className="nba-radar-table-sub">{axis.sub.replace(" inv", "").replace(/ · (OFF|DEF)/, "")}</span>
              </td>
              <td>{axis.format(axis.get(factors.away).value)}</td>
              <td>{axis.format(axis.get(factors.home).value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="nba-radar-footnote">
        Radar plots league percentile (dashed ring = median), outward = better on every axis. Headline numbers
        (Off/Def/Net Rating, Pace) sit above the chart since they&apos;re composites of these 8 factors, not a 9th
        axis.
      </p>
    </div>
  );
}
