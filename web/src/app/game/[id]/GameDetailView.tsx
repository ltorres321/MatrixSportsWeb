"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemberPreview, SHOW_MEMBER_PREVIEW_TOGGLE } from "@/lib/useMemberPreview";
import { teamByAlias, teamLogoPath } from "@/lib/teams";
import { scalePosition, type GameStat, type GameStatSide } from "@/lib/gameStats";
import AdFrame from "@/components/AdFrame";

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
        <span className="prob">{showScore ? game.teamA.score : `${game.teamA.winProb}%`}</span>
      </div>
      <div className="vs">{statusWord}</div>
      <div className="side">
        <span className="prob">{showScore ? game.teamB.score : `${game.teamB.winProb}%`}</span>
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

export default function GameDetailView({ game }: { game: GameStat }) {
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
        <main className="content-main">
          <Link href="/home" style={{ display: "inline-block", marginBottom: "1.5rem", color: "var(--text-dim)" }}>
            &larr; back to predictions
          </Link>

          <Hero game={game} />

          {locked ? (
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
                    feature. This one&apos;s part of the paid slate — the Game of the Week is always free to view in
                    full.
                  </p>
                  <Link className="btn btn-primary btn-block" href="/signup">
                    Sign Up Free
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <>
              <ResultCompare game={game} />
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

        <aside className="promo-column" aria-label="Promotional space">
          <AdFrame>
            <span className="slot-label">Ad space</span>
          </AdFrame>
          <AdFrame>
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
    </>
  );
}
