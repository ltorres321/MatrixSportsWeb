"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { NbaGameDetail, NbaInjuryEntry, NbaPropEdge } from "@/lib/nbaGameDetail";
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

function OverviewTab({ game }: { game: NbaGameDetail }) {
  return (
    <div className="page-edge-section">
      <p style={{ color: "var(--text-dim)" }}>
        Deeper team-form analysis (the NFL page&apos;s PFF grade sections) has no NBA equivalent source yet —
        see the Betting Edge tab for what IS real: {game.props.length} scored player props for this game.
      </p>
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
