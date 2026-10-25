"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { NbaGameDetail, NbaInjuryEntry, NbaPropEdge } from "@/lib/nbaGameDetail";
import type { StarterGradePlayer, TeamStarterGrades } from "@/lib/nbaStarterGrades";
import { teamLogoPath } from "@/lib/teamsNba";

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

type PageTab = "overview" | "matchups" | "bettingEdge" | "parlayHelper";

function PageTabStrip({ active, onChange }: { active: PageTab; onChange: (tab: PageTab) => void }) {
  const tabs: { key: PageTab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "matchups", label: "Matchups" },
    { key: "bettingEdge", label: "Betting Edge" },
    { key: "parlayHelper", label: "Parlay Helper" },
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
      {!game.starterGrades && (
        <p style={{ color: "var(--text-dim)" }}>
          Deeper team-form analysis (the NFL page&apos;s PFF grade sections) has no NBA equivalent source yet —
          see the Betting Edge tab for what IS real: {game.props.length} scored player props for this game.
        </p>
      )}
    </div>
  );
}

function MatchupsTab() {
  return (
    <div className="page-edge-section">
      <p style={{ color: "var(--text-dim)" }}>
        Team-vs-team form comparison — structure reserved, not built yet.
      </p>
    </div>
  );
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
  return (
    <div className="page-edge-section">
      <h3>Player Props</h3>
      <table className="prop-table">
        <thead>
          <tr>
            <th>Player</th>
            <th>Prop</th>
            <th>Pick</th>
            <th>Proj</th>
            <th>Cover Prob</th>
            <th>Edge</th>
            <th>Book</th>
          </tr>
        </thead>
        <tbody>
          {game.props.map((p, i) => (
            <tr key={i}>
              <td>{p.playerName}</td>
              <td>{p.stat}</td>
              <td style={{ textTransform: "capitalize" }}>{p.side} {p.line}</td>
              <td>{p.projection.toFixed(1)}</td>
              <td>{(p.coverProbability * 100).toFixed(0)}%</td>
              <td style={{ color: p.edge > 0 ? "var(--green)" : "var(--red)" }}>
                {p.edge >= 0 ? "+" : ""}{(p.edge * 100).toFixed(0)}%
              </td>
              <td style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
                {p.bookmaker} {p.price > 0 ? "+" : ""}{p.price}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
        <MatchupsTab />
      ) : activeTab === "bettingEdge" ? (
        <BettingEdgeTab game={game} />
      ) : (
        <ParlayHelperTab game={game} />
      )}
    </>
  );
}
