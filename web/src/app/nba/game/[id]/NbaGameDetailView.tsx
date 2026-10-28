"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { NbaGameDetail, NbaInjuryEntry, NbaPropEdge } from "@/lib/nbaGameDetail";
import type { StarterGradePlayer, TeamStarterGrades } from "@/lib/nbaStarterGrades";
import type { TeamGradeSet, TeamStatWithRank } from "@/lib/nbaTeamGrades";
import type { TeamPer100Stats, TeamPer100StatWithRank } from "@/lib/nbaEfficiencyScoring";
import { teamLogoPath } from "@/lib/teamsNba";
import { teamPrimaryColorNba } from "@/lib/teamColorsNba";
import { SportsbookLink } from "@/components/ParlayCard";
import NbaLineupSection from "./NbaLineupSection";

// Same polling interval as GameDetailView.tsx's LIVE_REFRESH_MS --
// router.refresh() re-runs getNbaGameDetail server-side, which re-hits
// nbaSchedule.ts's live feed (60s cache there, so this doesn't poll
// TheSportsDB any faster than that feed actually updates).
const LIVE_REFRESH_MS = 20_000;

// NBA equivalent of GameDetailView.tsx's real structure (confirmed
// against a live screenshot of the NFL page, not guessed): an
// always-visible Hero/Injury Report/Margin of Victory/Totals block,
// THEN a separate tab strip (Overview/Matchups/Betting Edge/Parlay
// Helper) below it for deeper analysis. The first build of this file
// wrongly put everything inside tabs -- fixed here to match the real
// page.
//
// Margin of Victory and Totals are now real (src4/34 + src4/26's
// Monte Carlo, centered on that file's own regression prediction --
// there's still no NBA market line anywhere in this project, see
// nbaGameDetail.ts's header). pct still renders as "—" / no bar only
// for a row that predates the simulation existing at all (null, not
// zero) -- that's a real absence-of-data case, not the normal path.

const INJURY_STATUS_CLASS: Record<string, string> = {
  Out: "injury-out",
  Doubtful: "injury-doubtful",
  Questionable: "injury-questionable",
  "Day-To-Day": "injury-questionable",
};

function InjuryColumn({ title, entries }: { title: string; entries: NbaInjuryEntry[] }) {
  return (
    <div className="injury-column">
      <div className="injury-column-title">{title}</div>
      {entries.length === 0 ? (
        <div className="injury-empty">Nothing on the report.</div>
      ) : (
        <ul className="injury-list">
          {entries.map((entry, i) => (
            <li className="injury-row" key={i}>
              <span className="injury-player">{entry.playerName}</span>
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

function Hero({ game }: { game: NbaGameDetail }) {
  const homeProb = Math.round(game.homeWinProbability * 100);
  const awayProb = 100 - homeProb;
  const showScore = game.isFinal || game.isLive;
  return (
    <div className="game-hero">
      <h1 className="sr-only">
        {game.awayTeamName} vs {game.homeTeamName} — Win Probability
      </h1>
      <div className="matchup-status" style={{ justifyContent: "center", marginBottom: "1.5rem" }}>
        {game.isFinal ? (
          <span className="tag final">FINAL</span>
        ) : game.isLive ? (
          <span className="tag live">
            <span className="blip" />
            LIVE — {game.livePeriod ?? "In Progress"}
          </span>
        ) : (
          <span className="tag preview">{game.kickoff}</span>
        )}
      </div>
      <div className="game-hero-teams">
        <div className="game-hero-team">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={teamLogoPath(game.awayTeam)} alt={`${game.awayTeamName} logo`} />
          <div className="name">{game.awayTeamName}</div>
          <div className="record">{game.awayRecord}</div>
          {showScore ? (
            <div className="big-prob">{game.actualAwayScore}</div>
          ) : (
            <div className="big-prob">
              {awayProb}
              <span className="unit">%</span>
            </div>
          )}
        </div>
        <div className="game-hero-vs">VS</div>
        <div className="game-hero-team">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={teamLogoPath(game.homeTeam)} alt={`${game.homeTeamName} logo`} />
          <div className="name">{game.homeTeamName}</div>
          <div className="record">{game.homeRecord}</div>
          {showScore ? (
            <div className="big-prob">{game.actualHomeScore}</div>
          ) : (
            <div className="big-prob">
              {homeProb}
              <span className="unit">%</span>
            </div>
          )}
        </div>
      </div>
      <div className="game-hero-meta">
        {game.oddsSource === "propline_market" && game.marketSpread && game.marketTotal
          ? `Market line: ${game.marketSpread}, total ${game.marketTotal} · Model expected score: ${game.awayTeamName} ${game.expectedAwayScore?.toFixed(1)} – ${game.homeTeamName} ${game.expectedHomeScore?.toFixed(1)}`
          : game.expectedHomeScore !== null && game.expectedAwayScore !== null
          ? `Model expected score: ${game.awayTeamName} ${game.expectedAwayScore.toFixed(1)} – ${game.homeTeamName} ${game.expectedHomeScore.toFixed(1)} (no market line posted for this game yet -- see Margin/Totals below)`
          : "Model expected score not calculated for this game yet — win probability above is real."}
      </div>
    </div>
  );
}

function InjuryReportSection({ game }: { game: NbaGameDetail }) {
  return (
    <div className="stat-section">
      <h2>Injury Report</h2>
      <p className="stat-sub">Live ESPN injury status for both teams, polled fresh each run.</p>
      <div className="injury-grid">
        <InjuryColumn title={game.awayTeam} entries={game.injuriesAway} />
        <InjuryColumn title={game.homeTeam} entries={game.injuriesHome} />
      </div>
    </div>
  );
}

function MarginSection({ game }: { game: NbaGameDetail }) {
  const actualLabel =
    game.isFinal && game.actualHomeScore !== null && game.actualAwayScore !== null
      ? marginBucketLabel(game.actualHomeScore - game.actualAwayScore)
      : null;

  return (
    <div className="stat-section">
      <h2>Margin of Victory — {game.homeTeamName} (Home)</h2>
      <p className="stat-sub">
        {actualLabel
          ? "Pregame odds for every possible outcome, simulated before tipoff -- the highlighted bar is what actually happened."
          : game.oddsSource === "propline_market"
          ? `How often each outcome happened for ${game.homeTeamName}, across 100,000 simulated versions of this game, centered on the real market spread (${game.marketSpread}).`
          : `How often each outcome happened for ${game.homeTeamName}, across 100,000 simulated versions of this game (centered on this model's own predicted margin -- no market line posted for this game yet).`}
      </p>
      <div className="bucket-list">
        {game.marginBuckets.map((b) => (
          <div className={`bucket-row ${b.label === actualLabel ? "bucket-actual" : ""}`} key={b.label}>
            <span className="bucket-label">
              {b.label}
              {b.label === actualLabel && <span className="actual-tag"> ← actual result</span>}
            </span>
            <div className="bucket-track">
              <div className="bucket-fill" style={{ width: `${b.pct ?? 0}%` }} />
            </div>
            <span className="bucket-pct">{b.pct === null ? "—" : `${b.pct}%`}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// NBA margin bucket boundaries match src4/26's MARGIN_THRESHOLDS
// exactly ([3, 7, 14, 21]) -- a positive margin is the HOME team's
// margin, same convention nbaGameDetail.ts's expectedMargin uses.
function marginBucketLabel(homeMargin: number): string {
  const magnitude = Math.abs(homeMargin);
  if (homeMargin <= 0) return "Lost / Tied";
  if (magnitude <= 3) return "Won by 1-3";
  if (magnitude <= 7) return "Won by 4-7";
  if (magnitude <= 14) return "Won by 8-14";
  if (magnitude <= 21) return "Won by 15-21";
  return "Won by 21+";
}

function TotalsSection({ game }: { game: NbaGameDetail }) {
  const actualTotal =
    game.isFinal && game.actualHomeScore !== null && game.actualAwayScore !== null
      ? game.actualHomeScore + game.actualAwayScore
      : null;

  const hasRealMarketLine = game.oddsSource === "propline_market";

  return (
    <div className="stat-section">
      <h2>Total Score — Over / Under</h2>
      <p className="stat-sub">
        Combined score across 100,000 simulated versions of this game, against six fixed lines
        {hasRealMarketLine
          ? `, centered on the real market total (${game.marketTotal})`
          : " (no market total posted for this game yet -- the highlighted line is this model's own pick, not a sportsbook number)"}
        {actualTotal !== null ? `. The real combined score was ${actualTotal}.` : "."}
      </p>
      <div className="totals-grid">
        {game.totals.map((t) => {
          const hit = actualTotal === null ? null : actualTotal > t.line ? "over" : "under";
          return (
            <div className={`totals-card ${t.isMarketLine ? "totals-market" : ""}`} key={t.line}>
              <div className="line">
                O/U LINE {t.line}
                {t.isMarketLine && (
                  <span className="market-line-tag">
                    {" "}
                    {hasRealMarketLine ? "MARKET LINE" : "MODEL'S PICK"}
                  </span>
                )}
              </div>
              <div className="split">
                <div className="over" style={{ width: `${t.over ?? 50}%` }} />
                <div className="under" style={{ width: `${t.under ?? 50}%` }} />
              </div>
              <div className="readout">
                <span className={`over-pct ${hit === "over" ? "actual-hit" : ""}`}>
                  {t.over === null ? "—" : `${t.over}%`} over{hit === "over" && " ✓"}
                </span>
                <span className={`under-pct ${hit === "under" ? "actual-hit" : ""}`}>
                  {t.under === null ? "—" : `${t.under}%`} under{hit === "under" && " ✓"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// "bettingEdge" was pulled from the tab strip 2026-10-27, then
// re-added the same day once projections v1 (src4/33) replaced the
// flat-average formula with the real rate x minutes x matchup model
// -- see src4/33's own module header and this repo's NBA Betting Edge
// memory for the full history. "parlayHelper" stays out: it still
// needs its own correlation-guardrail pass (same spec, later step)
// before this project is comfortable showing it.
type PageTab = "overview" | "matchups" | "bettingEdge";

function PageTabStrip({ active, onChange }: { active: PageTab; onChange: (tab: PageTab) => void }) {
  const tabs: { key: PageTab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "matchups", label: "Matchups" },
    { key: "bettingEdge", label: "Betting Edge" },
  ];
  return (
    <nav className="page-tab-strip" aria-label="Game detail sections">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          className={`week-pill ${active === t.key ? "active" : ""}`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}

// Same palette basketball-reference.com/PFF both land on for a "how
// good is this value" color scale -- reused verbatim from
// GameDetailView.tsx's GRADE_TIER_COLORS (NFL's PFF grade bands) for
// visual consistency across both sports' game-detail pages, just
// re-thresholded per basketball stat below since none of these three
// are a 0-100 PFF grade.
const STAT_TIER_COLORS = ["#0c5ea0", "#0287a5", "#00936e", "#18a33a", "#5eb90f", "#f1cf00", "#fd9700"];

// Rough real-world bands for each stat (season-to-date, starters
// only) -- PTS and PER both run roughly 0-35 for a starter, WS/48
// clusters tightly around a .100 league average (Basketball-Reference
// glossary), hence the much narrower breakpoints there.
const STAT_TIER_THRESHOLDS: Record<StarterStat, number[]> = {
  pts: [28, 23, 18, 14, 10, 6],
  per: [27, 23, 19, 15, 12, 8],
  wsPer48: [0.22, 0.18, 0.14, 0.1, 0.07, 0.04],
};

function statTierColor(stat: StarterStat, value: number): string {
  const thresholds = STAT_TIER_THRESHOLDS[stat];
  for (let i = 0; i < thresholds.length; i++) {
    if (value >= thresholds[i]) return STAT_TIER_COLORS[i];
  }
  return STAT_TIER_COLORS[STAT_TIER_COLORS.length - 1];
}

function formatStat(stat: StarterStat, value: number): string {
  if (stat === "wsPer48") {
    // Basketball-Reference's own convention: no leading zero
    // ("-.038", ".178"), 3 decimal places.
    const fixed = value.toFixed(3);
    return value < 0 ? `-${fixed.slice(2)}` : fixed.slice(1);
  }
  return value.toFixed(1);
}

type StarterStat = "pts" | "per" | "wsPer48";

// Same CDN/path convention as GameDetailView.tsx's espnHeadshotUrl,
// just the "nba" leaf instead of "nfl" -- confirmed live against a
// handful of real nba.rosters athlete_ids (nbaStarterGrades.ts's
// buildEspnIdByName) that this resolves to a real player photo.
function nbaEspnHeadshotUrl(espnId: string): string {
  return `https://a.espncdn.com/i/headshots/nba/players/full/${espnId}.png`;
}

// Same "photo if we have an id, else this player's own team logo"
// fallback as GameDetailView.tsx's PlayerHeadshot -- espnId here comes
// from a name-matched lookup against nba.rosters rather than a real
// player-id crosswalk (see buildEspnIdByName's header), so it's null
// for the minority of starters that table hasn't picked up yet.
function StarterGradeRow({ player, alias, stat }: { player: StarterGradePlayer; alias: string; stat: StarterStat }) {
  const value = player[stat];
  const tier = statTierColor(stat, value);
  return (
    <div className="report-player-row">
      {player.espnId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="player-headshot" src={nbaEspnHeadshotUrl(player.espnId)} alt="" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="player-headshot player-headshot-fallback" src={teamLogoPath(alias)} alt="" />
      )}
      <div className="report-player-info">
        <span className="report-player-name">{player.name}</span>
        {player.position && <span className="report-player-position">{player.position}</span>}
      </div>
      <div className="report-player-grade" style={{ borderColor: tier, backgroundColor: `${tier}20` }}>
        {formatStat(stat, value)}
      </div>
    </div>
  );
}

// Verbatim from Basketball-Reference's own glossary (the same
// glossary_advanced.md/glossary_per_game.md files SportsAnalytics'
// scraper copies into each season's advancemetrics/ folder) -- not
// paraphrased, so this stays the same explanation a reader would get
// hovering the equivalent column on basketball-reference.com itself.
const STAT_INFO: Record<StarterStat, { title: string; description: string }> = {
  pts: { title: "Points Per Game", description: "Points scored per game." },
  per: {
    title: "Player Efficiency Rating",
    description:
      "Player Efficiency Rating (John Hollinger) -- a per-minute rating summing a player's positive contributions and subtracting the negative, league-adjusted so 15.0 = average.",
  },
  wsPer48: {
    title: "Win Shares Per 48 Minutes",
    description:
      "An estimate of the number of wins contributed by a player per 48 minutes (league average is approximately .100).",
  },
};

const STAT_LABELS: Record<StarterStat, string> = { pts: "PTS", per: "PER", wsPer48: "WS/48" };

// Pure-CSS hover tooltip (no portal) -- unlike GameDetailView.tsx's
// click-triggered InfoTooltip, this card isn't inside a horizontally-
// scrolling wrapper, so a plain absolutely-positioned popover doesn't
// get clipped and hover is a closer match to how basketball-reference
// itself shows these definitions (see the screenshot that prompted
// this -- a hover popover on the WS/48 column header).
function StatToggleButton({ stat, active, onClick }: { stat: StarterStat; active: boolean; onClick: () => void }) {
  const info = STAT_INFO[stat];
  return (
    <span className="stat-toggle-info">
      <button type="button" className={active ? "active" : ""} onClick={onClick}>
        {STAT_LABELS[stat]}
      </button>
      <div className="stat-toggle-tooltip">
        <strong>{info.title}</strong>
        <span>{info.description}</span>
      </div>
    </span>
  );
}

function StarterGradesCard({ alias, team }: { alias: string; team: TeamStarterGrades }) {
  const [stat, setStat] = useState<StarterStat>("pts");
  const players = stat === "pts" ? team.byPts : stat === "per" ? team.byPer : team.byWs48;
  return (
    <div className="report-players-card">
      <div className="report-players-header">
        <span className="report-players-team">{alias}</span>
        <div className="report-toggle">
          <StatToggleButton stat="pts" active={stat === "pts"} onClick={() => setStat("pts")} />
          <StatToggleButton stat="per" active={stat === "per"} onClick={() => setStat("per")} />
          <StatToggleButton stat="wsPer48" active={stat === "wsPer48"} onClick={() => setStat("wsPer48")} />
        </div>
      </div>
      {players.length === 0 ? (
        <div className="report-players-empty">No qualifying players.</div>
      ) : (
        <div className="report-players-list">
          {players.map((player) => (
            <StarterGradeRow player={player} alias={alias} stat={stat} key={player.playerId} />
          ))}
        </div>
      )}
    </div>
  );
}

function StarterGradesSection({ game }: { game: NbaGameDetail }) {
  if (!game.starterGrades) return null;
  return (
    <div className="stat-section">
      <h2>Starter Grades</h2>
      <p className="stat-sub">
        Season-to-date Basketball-Reference stats for each team&apos;s starters, minimum 25% of that team&apos;s
        games started.
      </p>
      <div className="report-players-grid">
        <StarterGradesCard alias={game.awayTeam} team={game.starterGrades.away} />
        <StarterGradesCard alias={game.homeTeam} team={game.starterGrades.home} />
      </div>
    </div>
  );
}

function OverviewTab({ game }: { game: NbaGameDetail }) {
  return (
    <div className="page-edge-section">
      <StarterGradesSection game={game} />
      <TeamGradesSection game={game} />
      <EfficiencyScoringSection game={game} />
      {!game.starterGrades && !game.teamGrades && !game.efficiencyScoring && (
        <p style={{ color: "var(--text-dim)" }}>
          Deeper team-form analysis isn&apos;t available yet for this matchup — see the Betting Edge tab for what
          IS real: {game.props.length} scored player props for this game.
        </p>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// Team Grades (Core Four / Four Factors / Net Efficiency, computed in
// nbaTeamGrades.ts from hoopR's real box scores) -- lives in the
// Overview tab, under Starter Grades (NOT Matchups -- that tab is
// still reserved, see MatchupsTab below). NBA equivalent of
// GameDetailView.tsx's TeamGradesSection -- reuses that same page's
// edge-row-v2/edge-value/edge-track-v2/team-grades-* CSS (globals.css
// is shared across both sports' game-detail pages), just with
// NBA-specific team colors/tier coloring/formatting instead of
// gradeTierColor (there's no 0-100 PFF-style grade here).
// ----------------------------------------------------------------------

// Same ordinal-suffix formatting as GameDetailView.tsx's own ordinal()
// -- duplicated here since it's pure display formatting, same
// rationale as that file's own comment on why it isn't shared.
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

// Same luminance-lift trick as GameDetailView.tsx's edgeAccentColor
// (a team's own primary color, lifted toward white only when it's too
// dark to read against this page's near-black background), just
// sourced from teamColorsNba.ts instead of the NFL color table.
function nbaEdgeAccentColor(alias: string): string {
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

type TeamGradeKey = Exclude<keyof TeamGradeSet, "alias" | "gamesPlayed">;

// There's no fixed 0-100 scale for any of these (unlike PFF grades),
// so the value box is colored by this team's RANK among the league
// instead -- reuses the same 7-step best-to-worst palette
// OverviewTab's STAT_TIER_COLORS already defines, just picked by rank
// percentile rather than an absolute threshold. rank is already
// direction-aware (1 = best) from nbaTeamGrades.ts's own ranking, so
// this needs no separate "lower is better" handling.
function tierColorByRank(rank: number, totalTeams: number): string {
  const pct = (rank - 1) / Math.max(1, totalTeams - 1);
  const index = Math.min(STAT_TIER_COLORS.length - 1, Math.floor(pct * STAT_TIER_COLORS.length));
  return STAT_TIER_COLORS[index];
}

// efgPct/tovPct/orebPct/ftRate all arrive as raw 0.0-1.0 fractions
// (see nbaTeamGrades.ts's own comment on why) -- formatting is the
// one place that needs to know which of those read as a "%" (bref
// convention) and which reads as a bare decimal (ftRate, same
// no-leading-"%" convention as Starter Grades' WS/48).
// 2 decimal places everywhere EXCEPT ftRate (bref's own 3-decimal,
// no-leading-zero convention, same as Starter Grades' WS/48 -- ".325"
// not ".33") -- pace's own comment explains why 1 decimal was the
// original bug-lookalike (teams with genuinely different ranks
// rounding to the exact same displayed number); the same risk exists
// for every other stat here too once enough teams have played enough
// games to cluster tightly, so this applies the fix everywhere
// up front rather than waiting for the next one to get reported.
function formatTeamStat(key: TeamGradeKey, value: number): string {
  switch (key) {
    case "efgPct":
    case "tovPct":
    case "orebPct":
      return `${(value * 100).toFixed(2)}%`;
    case "ftRate":
      return value.toFixed(3).slice(1);
    case "netRtg":
      return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
    default:
      return value.toFixed(2);
  }
}

const TEAM_GRADE_LABELS: Record<TeamGradeKey, string> = {
  ppg: "Points",
  rpg: "Rebounds",
  apg: "Assists",
  pace: "Pace",
  efgPct: "eFG%",
  tovPct: "TOV%",
  orebPct: "OREB%",
  ftRate: "FT Rate",
  offRtg: "Off Rating",
  defRtg: "Def Rating",
  netRtg: "Net Rating",
};

// Same sourcing rule as Starter Grades' STAT_INFO -- pulled from
// Basketball-Reference's own glossary (glossary_totals.md/
// glossary_advanced.md/glossary_adj_shooting.md/glossary_per_poss.md,
// the files SportsAnalytics' scraper copies alongside the data),
// adapted from their player-level "while on court" phrasing to a
// team-level one where that's all that changed. Pace and Net Rating
// have no scraped glossary entry (Pace is a team-only stat on a page
// this project never scrapes; Net Rating is simply Off minus Def) --
// Pace below is basketball-reference's own standard published
// definition, and Net Rating's description leans on the same framing
// the user supplied when this card was first scoped. Only the 8
// metrics asked for get an entry -- Points/Rebounds/Assists are
// self-explanatory and were deliberately left out, same as Starter
// Grades left PTS mostly unexplained in spirit (kept there only for
// toggle-button symmetry).
const TEAM_GRADE_INFO: Partial<Record<TeamGradeKey, { title: string; description: string }>> = {
  pace: {
    title: "Pace",
    description: "An estimate of the number of possessions per 48 minutes by a team.",
  },
  efgPct: {
    title: "Effective Field Goal Percentage",
    description:
      "(FG + 0.5 x 3P) / FGA. Weights a made 3 as worth 1.5 made 2s, since it's worth one more point.",
  },
  tovPct: {
    title: "Turnover Percentage",
    description: "Estimated turnovers per 100 plays.",
  },
  orebPct: {
    title: "Offensive Rebound Percentage",
    description: "Estimated percentage of available offensive rebounds grabbed.",
  },
  ftRate: {
    title: "Free Throw Attempt Rate",
    description: "FTA / FGA -- how often a team gets to the line relative to its field goal attempts.",
  },
  offRtg: {
    title: "Offensive Rating",
    description: "Points produced per 100 possessions (Dean Oliver method), team-pace-adjusted.",
  },
  defRtg: {
    title: "Defensive Rating",
    description: "Points allowed per 100 possessions (Dean Oliver method), team-pace-adjusted.",
  },
  netRtg: {
    title: "Net Rating",
    description:
      "Offensive Rating minus Defensive Rating -- point differential per 100 possessions, the single best metric for evaluating a team's true strength.",
  },
};

// Same pure-CSS hover popover as Starter Grades' StatToggleButton
// (stat-toggle-info/stat-toggle-tooltip, already defined in globals.css
// for that card) -- reused here on the row label instead of a toggle
// button, since Team Grades has no toggle to hang it off of. A row
// with no TEAM_GRADE_INFO entry (Points/Rebounds/Assists) renders as
// plain text, same as before.
function TeamGradeLabel({ statKey }: { statKey: TeamGradeKey }) {
  const info = TEAM_GRADE_INFO[statKey];
  const label = TEAM_GRADE_LABELS[statKey];
  if (!info) return <div className="edge-row-label">{label}</div>;
  return (
    <div className="edge-row-label">
      <span className="stat-toggle-info">
        {label}
        <div className="stat-toggle-tooltip">
          <strong>{info.title}</strong>
          <span>{info.description}</span>
        </div>
      </span>
    </div>
  );
}

// Order mirrors the reference breakdown this card was built from:
// Core Four, then Four Factors, then Net Efficiency -- 11 rows total,
// the same count as the NFL page's own Team Grades card.
const TEAM_GRADE_ORDER: TeamGradeKey[] = [
  "ppg", "rpg", "apg", "pace",
  "efgPct", "tovPct", "orebPct", "ftRate",
  "offRtg", "defRtg", "netRtg",
];

// netRtg is a signed differential (often negative) -- the share-of-
// sum bar math below only means something for a genuinely
// non-negative stat, so that row renders the same "nothing to compare"
// flat track EdgeTrack itself falls back to when a side is missing,
// rather than producing a nonsensical split.
const NO_SHARE_BAR: Set<TeamGradeKey> = new Set(["netRtg"]);

function TeamGradeValue({
  stat,
  alias,
  align,
  statKey,
  totalTeams,
}: {
  stat: TeamStatWithRank;
  alias: string;
  align: "left" | "right";
  statKey: TeamGradeKey;
  totalTeams: number;
}) {
  const tier = tierColorByRank(stat.rank, totalTeams);
  const isTop5 = stat.rank <= 5;
  return (
    <div className={`edge-value edge-value-${align}`}>
      <span className="edge-value-team">{alias}</span>
      <div
        className={`edge-value-box ${isTop5 ? "edge-value-box-top5" : ""}`}
        style={{ borderColor: tier, backgroundColor: `${tier}20` }}
      >
        {formatTeamStat(statKey, stat.value)}
      </div>
      <span className={`edge-value-rank ${isTop5 ? "edge-value-rank-top5" : ""}`}>
        {stat.tied ? "T-" : ""}
        {ordinal(stat.rank)} / {totalTeams}
      </span>
    </div>
  );
}

function TeamGradeTrack({
  statKey,
  away,
  home,
  awayAlias,
  homeAlias,
}: {
  statKey: TeamGradeKey;
  away: TeamStatWithRank;
  home: TeamStatWithRank;
  awayAlias: string;
  homeAlias: string;
}) {
  if (NO_SHARE_BAR.has(statKey)) return <div className="edge-track-v2 edge-track-v2-empty" />;
  const lowerIsBetter = statKey === "tovPct" || statKey === "defRtg";
  const total = away.value + home.value;
  const leftPct = total > 0 ? (away.value / total) * 100 : 50;
  const rightPct = 100 - leftPct;
  const leftBehind = lowerIsBetter ? leftPct > rightPct : leftPct < rightPct;
  const rightBehind = lowerIsBetter ? rightPct > leftPct : rightPct < leftPct;
  return (
    <div className="edge-track-v2">
      <div
        className={`edge-fill-v2 ${leftBehind ? "edge-fill-behind" : ""}`}
        style={{ width: `${leftPct}%`, background: nbaEdgeAccentColor(awayAlias) }}
      />
      <div
        className={`edge-fill-v2 ${rightBehind ? "edge-fill-behind" : ""}`}
        style={{ width: `${rightPct}%`, background: nbaEdgeAccentColor(homeAlias) }}
      />
    </div>
  );
}

function TeamGradesSection({ game }: { game: NbaGameDetail }) {
  if (!game.teamGrades) return null;
  const { home, away, totalTeams } = game.teamGrades;
  const awayAlias = game.awayTeam;
  const homeAlias = game.homeTeam;
  const awayColor = nbaEdgeAccentColor(awayAlias);
  const homeColor = nbaEdgeAccentColor(homeAlias);
  return (
    <div className="stat-section">
      <h2>Team Grades</h2>
      <p className="stat-sub">
        Both teams&apos; own season-to-date production, ranked against the rest of the league -- Core Four, Four
        Factors, and Net Efficiency, computed from real box scores (regular season only).
      </p>
      <div className="team-grades-card">
        <div
          className="team-grades-header"
          style={{ background: `linear-gradient(135deg, ${awayColor} 0%, ${awayColor} 45%, ${homeColor} 55%, ${homeColor} 100%)` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="team-grades-logo" src={teamLogoPath(awayAlias)} alt="" />
          <span className="team-grades-caption">Ranked all {totalTeams} teams</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="team-grades-logo" src={teamLogoPath(homeAlias)} alt="" />
        </div>
        <div className="team-grades-rows">
          {TEAM_GRADE_ORDER.map((key) => (
            <div className="edge-row-v2" key={key}>
              <TeamGradeValue stat={away[key]} alias={awayAlias} align="left" statKey={key} totalTeams={totalTeams} />
              <TeamGradeLabel statKey={key} />
              <TeamGradeValue stat={home[key]} alias={homeAlias} align="right" statKey={key} totalTeams={totalTeams} />
              <TeamGradeTrack statKey={key} away={away[key]} home={home[key]} awayAlias={awayAlias} homeAlias={homeAlias} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Efficiency and Scoring -- "Team" (this team's own shooting/
// rebounding/ballhandling) side by side with "Opponent" (what the
// teams THIS team played did against them in those same games, i.e.
// "allowed"), per 100 possessions, ranked against the league. Titled
// "Team"/"Opponent" rather than "Offense"/"Defense" -- bref's own
// neutral naming, adopted here after "Defense" read as implying every
// row was a measure of this team's OWN defense, which isn't true for
// steals/blocks/rebounds (those are the opponent's own hustle stats
// against this team, not this team's defensive production at all; see
// this section's own explainer text below, and the comment on
// DEFENSE_LOWER_IS_BETTER in nbaEfficiencyScoring.ts). NBA equivalent
// of GameDetailView.tsx's EfficiencyCard/EfficiencySection -- reuses
// that same page's eff-grid/eff-card/eff-row-v2/eff-figure CSS
// (globals.css is shared across both sports' game-detail pages), with
// a plain figure+rank (no color-tier box, no share bar) exactly like
// the NFL version, since there's no PFF-style grade or signed
// differential here to color/bar.
// ----------------------------------------------------------------------

type EffStatKey = keyof TeamPer100Stats;

const EFF_LABELS: Record<EffStatKey, string> = {
  fgPct: "FG%",
  threeP: "3P",
  threePA: "3PA",
  threePct: "3P%",
  twoP: "2P",
  twoPA: "2PA",
  twoPct: "2P%",
  ft: "FT",
  fta: "FTA",
  ftPct: "FT%",
  orb: "ORB",
  drb: "DRB",
  stl: "STL",
  blk: "BLK",
  tov: "TOV",
  pf: "PF",
};

// Same order as the real Basketball-Reference "Per 100 Poss Stats"
// page's own column order (and the order the user pasted it in) --
// minus AST/TRB, deliberately left out (see nbaEfficiencyScoring.ts's
// own header: both are the exact same raw total Team Grades already
// shows, as Assists/Rebounds, just per-game instead of per-100).
const EFF_ORDER: EffStatKey[] = [
  "fgPct", "threeP", "threePA", "threePct", "twoP", "twoPA", "twoPct",
  "ft", "fta", "ftPct", "orb", "drb", "stl", "blk", "tov", "pf",
];

const PCT_STATS: Set<EffStatKey> = new Set(["fgPct", "threePct", "twoPct", "ftPct"]);

function formatEffStat(key: EffStatKey, value: number): string {
  return PCT_STATS.has(key) ? `${(value * 100).toFixed(2)}%` : value.toFixed(2);
}

// Verbatim labels from Basketball-Reference's own "Per 100 Poss
// Stats" glossary (the user's pasted glossary block) -- description
// adds the one piece of real context their own terse "label --
// expansion" glossary doesn't spell out: the formula for a percentage
// stat, or that a counting stat here is scaled to per-100-possessions
// rather than a per-game total.
const EFF_INFO: Record<EffStatKey, { title: string; description: string }> = {
  fgPct: { title: "Field Goal Percentage", description: "Field Goals made / Field Goal Attempts." },
  threeP: { title: "3-Point Field Goals", description: "Per 100 possessions." },
  threePA: { title: "3-Point Field Goal Attempts", description: "Per 100 possessions." },
  threePct: { title: "3-Point Field Goal Percentage", description: "3-Point Field Goals made / 3-Point Field Goal Attempts." },
  twoP: { title: "2-Point Field Goals", description: "Per 100 possessions." },
  twoPA: { title: "2-Point Field Goal Attempts", description: "Per 100 possessions." },
  twoPct: { title: "2-Point Field Goal Percentage", description: "2-Point Field Goals made / 2-Point Field Goal Attempts." },
  ft: { title: "Free Throws", description: "Per 100 possessions." },
  fta: { title: "Free Throw Attempts", description: "Per 100 possessions." },
  ftPct: { title: "Free Throw Percentage", description: "Free Throws made / Free Throw Attempts." },
  orb: { title: "Offensive Rebounds", description: "Per 100 possessions." },
  drb: { title: "Defensive Rebounds", description: "Per 100 possessions." },
  stl: { title: "Steals", description: "Per 100 possessions." },
  blk: { title: "Blocks", description: "Per 100 possessions." },
  tov: { title: "Turnovers", description: "Per 100 possessions." },
  pf: { title: "Personal Fouls", description: "Per 100 possessions." },
};

// Same pure-CSS hover popover as Starter Grades/Team Grades (reuses
// stat-toggle-info/stat-toggle-tooltip, already in globals.css).
function EffRowLabel({ statKey }: { statKey: EffStatKey }) {
  const info = EFF_INFO[statKey];
  return (
    <span className="eff-row-label">
      <span className="stat-toggle-info">
        {EFF_LABELS[statKey]}
        <div className="stat-toggle-tooltip">
          <strong>{info.title}</strong>
          <span>{info.description}</span>
        </div>
      </span>
    </span>
  );
}

function EffFigure({
  stat,
  statKey,
  totalTeams,
  align,
}: {
  stat: TeamPer100StatWithRank;
  statKey: EffStatKey;
  totalTeams: number;
  align: "left" | "right";
}) {
  const isTop5 = stat.rank <= 5;
  // Bottom-5-in-the-league callout, the red counterpart to isTop5's
  // gold -- totalTeams - 5 is always >= 25 at a real 30-team league
  // size, so this and isTop5 can never both be true.
  const isBottom5 = stat.rank > totalTeams - 5;
  const tierClass = isTop5 ? "top5" : isBottom5 ? "bottom5" : "";
  return (
    <div className={`eff-figure-block eff-figure-block-${align}`}>
      <span className={`eff-figure ${tierClass ? `eff-figure-${tierClass}` : ""}`}>
        {formatEffStat(statKey, stat.value)}
      </span>
      <span className={`eff-rank ${tierClass ? `eff-rank-${tierClass}` : ""}`}>
        {stat.tied ? "T-" : ""}
        {ordinal(stat.rank)}/{totalTeams}
      </span>
    </div>
  );
}

function EffStatRow({
  statKey,
  away,
  home,
  totalTeams,
}: {
  statKey: EffStatKey;
  away: TeamPer100StatWithRank;
  home: TeamPer100StatWithRank;
  totalTeams: number;
}) {
  return (
    <div className="eff-row-v2">
      <EffFigure stat={away} statKey={statKey} totalTeams={totalTeams} align="left" />
      <EffRowLabel statKey={statKey} />
      <EffFigure stat={home} statKey={statKey} totalTeams={totalTeams} align="right" />
    </div>
  );
}

function EfficiencyCard({
  title,
  awayAlias,
  homeAlias,
  awayStats,
  homeStats,
  totalTeams,
}: {
  title: string;
  awayAlias: string;
  homeAlias: string;
  awayStats: TeamPer100Stats;
  homeStats: TeamPer100Stats;
  totalTeams: number;
}) {
  const awayColor = nbaEdgeAccentColor(awayAlias);
  const homeColor = nbaEdgeAccentColor(homeAlias);
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
      <div className="eff-card-rows">
        {EFF_ORDER.map((key) => (
          <EffStatRow key={key} statKey={key} away={awayStats[key]} home={homeStats[key]} totalTeams={totalTeams} />
        ))}
      </div>
    </div>
  );
}

function EfficiencyScoringSection({ game }: { game: NbaGameDetail }) {
  if (!game.efficiencyScoring) return null;
  const { homeOffense, awayOffense, homeDefense, awayDefense, totalTeams } = game.efficiencyScoring;
  const awayAlias = game.awayTeam;
  const homeAlias = game.homeTeam;
  return (
    <div className="stat-section">
      <h2>Efficiency and Scoring per 100 possessions</h2>
      <p className="stat-sub">Season-to-date shooting, rebounding, and ballhandling per 100 possessions.</p>
      <p className="stat-sub eff-scoring-subtitle">
        &quot;Team&quot; is each team&apos;s own production. &quot;Opponent&quot; is what they allowed their opponent
        to average. Both ranked against all {totalTeams} teams.
      </p>
      <div className="eff-grid nba-eff-grid">
        <EfficiencyCard
          title="Team"
          awayAlias={awayAlias}
          homeAlias={homeAlias}
          awayStats={awayOffense}
          homeStats={homeOffense}
          totalTeams={totalTeams}
        />
        <EfficiencyCard
          title="Opponent"
          awayAlias={awayAlias}
          homeAlias={homeAlias}
          awayStats={awayDefense}
          homeStats={homeDefense}
          totalTeams={totalTeams}
        />
      </div>
    </div>
  );
}

function MatchupsTab({ game }: { game: NbaGameDetail }) {
  return (
    <div className="page-edge-section">
      <NbaLineupSection game={game} />
    </div>
  );
}

// Raw DB stat values -> display label. "pra" especially needs this --
// see PLAYER_PROP_COLUMN_INFO.pra below for the tooltip explaining it.
const STAT_DISPLAY_LABEL: Record<string, string> = {
  points: "Points", rebounds: "Rebounds", assists: "Assists",
  threes: "Threes", blocks: "Blocks", steals: "Steals",
  turnovers: "Turnovers", pra: "PRA",
};

// Mirrors GameDetailView.tsx's own PLAYER_PROP_COLUMN_INFO pattern
// (same InfoTooltip component, duplicated locally rather than shared
// across sport pages -- see this file's own module header for why NBA
// keeps parallel-but-separate implementations from NFL throughout).
const PLAYER_PROP_COLUMN_INFO = {
  pra: "PRA = Points + Rebounds + Assists added together for one game -- a single combo stat some books post their own line for.",
  l5: "This player's average for this exact stat over their last 5 games played.",
  l10: "This player's average for this exact stat over their last 10 games played.",
  hitRate: "How many of the player's last 5 games would have covered THIS line and side (e.g. 3/5). Fewer than 5 means fewer than 5 games are available yet (a recent call-up, early-season rookie).",
  h2h: "How many of the player's last meetings against THIS opponent (up to 5, whatever history exists) would have covered this line and side. 0 attempts means no prior meetings on record.",
};

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
      <button type="button" ref={buttonRef} className="betting-info-icon" aria-label="More info" onClick={toggle}>
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

function hitRateText(hits: number | null, attempts: number) {
  return attempts > 0 ? `${hits ?? 0}/${attempts}` : "—";
}

function BettingEdgeTab({ game }: { game: NbaGameDetail }) {
  if (game.props.length === 0) {
    return (
      <div className="page-edge-section">
        <p style={{ color: "var(--text-dim)" }}>
          No player props scored for this game yet — props post closer to tipoff.
        </p>
      </div>
    );
  }
  // Reuses NFL's .betting-table/-wrap/-sticky-col/-fade classes
  // (globals.css ~L5665-5748) instead of the plain .prop-table -- same
  // sticky Player column with an explicit solid background ("backdrop
  // cover") so scrolled content can't show through it, same
  // right-edge scroll-fade cue. Deliberately NOT using
  // .betting-table-outer's width-breakout (the mechanism implicated in
  // the ad-rail collision reported on NFL) -- this wrapper is plain
  // `position: relative` instead, so NBA doesn't inherit that bug
  // while it's still unresolved on NFL's side.
  //
  // Props already arrive ORDER BY edge DESC from nbaGameDetail.ts (and
  // already floored at MIN_DISPLAYED_EDGE there) -- the # column below
  // is just making that existing rank visible, not a new sort.
  return (
    <div className="page-edge-section">
      <h3>
        Player Props <InfoTooltip text="Projections, lines, and edges below are this project's own model -- every number here is computed in-house from box-score history, not a licensed third-party grade." />
      </h3>
      <div style={{ position: "relative" }}>
        <div className="betting-table-wrap">
          <table className="betting-table">
            <thead>
              <tr>
                <th>#</th>
                <th className="betting-table-sticky-col">Player</th>
                <th>Prop</th>
                <th>Pick</th>
                <th>Proj</th>
                <th>Cover Prob</th>
                <th>Edge</th>
                <th>L5 <InfoTooltip text={PLAYER_PROP_COLUMN_INFO.l5} /></th>
                <th>L10 <InfoTooltip text={PLAYER_PROP_COLUMN_INFO.l10} /></th>
                <th>Hit Rate <InfoTooltip text={PLAYER_PROP_COLUMN_INFO.hitRate} /></th>
                <th>H2H <InfoTooltip text={PLAYER_PROP_COLUMN_INFO.h2h} /></th>
                <th>Book</th>
              </tr>
            </thead>
            <tbody>
              {game.props.map((p, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td className="betting-table-sticky-col">{p.playerName}</td>
                  <td>
                    {STAT_DISPLAY_LABEL[p.stat] ?? p.stat}
                    {p.stat === "pra" && <InfoTooltip text={PLAYER_PROP_COLUMN_INFO.pra} />}
                  </td>
                  <td style={{ textTransform: "capitalize" }}>{p.side} {p.line}</td>
                  <td>{p.projection.toFixed(1)}</td>
                  <td>{(p.coverProbability * 100).toFixed(0)}%</td>
                  <td style={{ color: p.edge > 0 ? "var(--green)" : "var(--red)" }}>
                    {p.edge >= 0 ? "+" : ""}{(p.edge * 100).toFixed(0)}%
                  </td>
                  <td>{p.l5Avg != null ? p.l5Avg.toFixed(1) : "—"}</td>
                  <td>{p.l10Avg != null ? p.l10Avg.toFixed(1) : "—"}</td>
                  <td>{hitRateText(p.hitRateHits, p.hitRateAttempts)}</td>
                  <td>{hitRateText(p.h2hHits, p.h2hAttempts)}</td>
                  <td style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8rem", color: "var(--text-dim)" }}>
                    <SportsbookLink sportsbook={p.bookmaker} />
                    {p.price > 0 ? "+" : ""}{p.price}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="betting-table-fade" aria-hidden="true" />
      </div>
    </div>
  );
}

// Simple same-game parlay: top props by edge, paired into 2-leg
// combos (combined probability = product of each leg's cover
// probability -- the same independence assumption football's own
// parlayHelper.ts makes). No same-book combined pricing yet.
function buildParlays(props: NbaPropEdge[]) {
  const pool = [...props].filter((p) => p.edge > 0).sort((a, b) => b.edge - a.edge).slice(0, 6);
  const combos: { legs: NbaPropEdge[]; probability: number }[] = [];
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      combos.push({
        legs: [pool[i], pool[j]],
        probability: pool[i].coverProbability * pool[j].coverProbability,
      });
    }
  }
  return combos.sort((a, b) => b.probability - a.probability).slice(0, 5);
}

function ParlayHelperTab({ game }: { game: NbaGameDetail }) {
  const parlays = buildParlays(game.props);
  if (parlays.length === 0) {
    return (
      <div className="page-edge-section">
        <p style={{ color: "var(--text-dim)" }}>
          Not enough positive-edge props scored for this game yet to build a parlay.
        </p>
      </div>
    );
  }
  return (
    <div className="page-edge-section">
      <h3>Suggested 2-Leg Parlays</h3>
      <p style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>
        Combined probability only — same-book combined pricing isn&apos;t built yet.
      </p>
      {parlays.map((combo, i) => (
        <div key={i} className="matchup-card" style={{ marginBottom: "0.75rem" }}>
          {combo.legs.map((leg, j) => (
            <div key={j} className="team-row">
              <div className="team-info">
                <div className="team-name">{leg.playerName}</div>
                <div className="team-record" style={{ textTransform: "capitalize" }}>
                  {leg.side} {leg.line} {leg.stat}
                </div>
              </div>
              <div className="team-metric">
                <div className="team-prob">{(leg.coverProbability * 100).toFixed(0)}%</div>
              </div>
            </div>
          ))}
          <div className="vs-divider">Combined: {(combo.probability * 100).toFixed(0)}%</div>
        </div>
      ))}
    </div>
  );
}

export default function NbaGameDetailView({ game }: { game: NbaGameDetail }) {
  const [activeTab, setActiveTab] = useState<PageTab>("overview");
  const router = useRouter();

  useEffect(() => {
    if (!game.isLive) return;
    const interval = setInterval(() => router.refresh(), LIVE_REFRESH_MS);
    return () => clearInterval(interval);
  }, [game.isLive, router]);

  return (
    <>
      <Link href="/home/nba" style={{ display: "inline-block", margin: "1rem 0", color: "var(--text-dim)" }}>
        ← back to predictions
      </Link>
      <Hero game={game} />
      <InjuryReportSection game={game} />
      <MarginSection game={game} />
      <TotalsSection game={game} />

      <PageTabStrip active={activeTab} onChange={setActiveTab} />
      {activeTab === "overview" ? (
        <OverviewTab game={game} />
      ) : activeTab === "matchups" ? (
        <MatchupsTab game={game} />
      ) : (
        <BettingEdgeTab game={game} />
      )}
    </>
  );
}
