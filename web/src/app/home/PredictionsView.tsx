"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemberPreview, SHOW_MEMBER_PREVIEW_TOGGLE } from "@/lib/useMemberPreview";
import type { Matchup } from "@/lib/matchups";
import MatchupCard from "@/components/MatchupCard";
import AdFrame from "@/components/AdFrame";

// How often to re-fetch while at least one game on screen is live --
// short enough to feel real-time, long enough not to hammer the
// server (each refresh re-runs the Server Component, which itself
// only re-hits ESPN at most once per liveScores.ts's own 30s cache).
const LIVE_REFRESH_MS = 20_000;

export default function PredictionsView({
  seasons,
  weeks,
  activeSeason,
  activeWeek,
  matchups,
}: {
  seasons: number[];
  weeks: number[];
  activeSeason: number | null;
  activeWeek: number | null;
  matchups: Matchup[];
}) {
  const { isMember, isRealMember, toggle } = useMemberPreview();
  const router = useRouter();
  const hasLiveGame = matchups.some((m) => m.status === "live");

  // Re-runs the Server Component data fetch on an interval so scores
  // actually move while someone's sitting on the page, not just on a
  // manual reload -- stops polling automatically the moment nothing
  // in view is live anymore (a fresh prop from the server re-render
  // naturally flips hasLiveGame to false once every game's final).
  useEffect(() => {
    if (!hasLiveGame) return;
    const interval = setInterval(() => router.refresh(), LIVE_REFRESH_MS);
    return () => clearInterval(interval);
  }, [hasLiveGame, router]);

  if (activeSeason === null) {
    return (
      <>
        <header className="site-header">
          <h1 className="glow">PREDICTIONS</h1>
          <p className="subtitle">{"// no model output yet"}</p>
        </header>
        <main>
          <p style={{ textAlign: "center", color: "var(--text-dim)" }}>
            No predictions have been generated yet. Check back once the model has run for a season.
          </p>
        </main>
      </>
    );
  }

  const premier = matchups.find((m) => m.premier);
  const rest = matchups.filter((m) => !m.premier);
  const locked = !isMember;

  return (
    <>
      <header className="site-header">
        <h1 className="glow">
          {activeSeason} SEASON — WEEK {activeWeek} PREDICTIONS
        </h1>
        <p className="subtitle">{"// AI-simulated win probabilities for every NFL matchup"}</p>
        {hasLiveGame && (
          <p className="subtitle" style={{ color: "var(--red)" }}>
            <span className="live-blip" style={{ display: "inline-block", marginRight: "0.4em" }} />
            Live scores updating automatically
          </p>
        )}
      </header>

      <div className="league-chips" aria-label="Sport selector">
        <button className="league-chip active" type="button">
          NFL
        </button>
        <button className="league-chip" type="button" disabled>
          NBA
          <span className="soon-tag">COMING SOON</span>
        </button>
        <button className="league-chip" type="button" disabled>
          MLB
          <span className="soon-tag">COMING SOON</span>
        </button>
      </div>

      <nav className="season-rail" aria-label="Season selector">
        {seasons.map((year) => (
          <Link
            key={year}
            href={`/home?season=${year}`}
            className={`week-pill ${year === activeSeason ? "active" : ""}`}
          >
            {year}
          </Link>
        ))}
      </nav>

      <nav className="week-rail" aria-label="Week selector">
        {weeks.map((w) => (
          <Link
            key={w}
            href={`/home?season=${activeSeason}&week=${w}`}
            className={`week-pill ${w === activeWeek ? "active" : ""}`}
          >
            WK {w}
          </Link>
        ))}
      </nav>

      <div className="content-split">
        <aside className="promo-rail promo-rail-left" aria-label="Promotional space">
          <AdFrame>
            <span className="slot-label">Ad space</span>
          </AdFrame>
          <AdFrame>
            <span className="slot-label">Ad space</span>
          </AdFrame>
        </aside>

        <main className="content-main">
          {matchups.length === 0 ? (
            <p style={{ textAlign: "center", color: "var(--text-dim)" }}>
              No predictions for Week {activeWeek} yet.
            </p>
          ) : (
            <>
              {premier && (
                <div className="premier-wrap">
                  <div className={`premier-ribbon ${premier.lockOfWeek ? "gold" : ""}`}>
                    {premier.lockOfWeek
                      ? "🔒 LOCK OF THE WEEK"
                      : isRealMember
                        ? "★ GAME OF THE WEEK — FREE PREVIEW"
                        : "★ FREE GAME OF THE WEEK — FREE PREVIEW"}
                  </div>
                  <MatchupCard matchup={premier} premier />
                </div>
              )}

              <div className="section-label">
                <span className="dot" /> FULL WEEK {activeWeek} SLATE
              </div>

              <div className={`locked-section ${locked ? "is-locked" : ""}`}>
                <div className="matchup-grid">
                  {rest.map((m) => (
                    <MatchupCard key={m.id} matchup={m} />
                  ))}
                </div>
                {locked && (
                  <div className="unlock-panel">
                    <div className="unlock-card">
                      <span className="lock-icon">🔒</span>
                      <h3>Unlock the Full Slate</h3>
                      <p>
                        Create a free account to see win probabilities for every
                        game, every week — no credit card required.
                      </p>
                      <Link className="btn btn-primary btn-block" href="/signup">
                        Sign Up Free
                      </Link>
                    </div>
                  </div>
                )}
              </div>
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
            <span className="slot-label">Ad space</span>
          </AdFrame>
          <AdFrame>
            <span className="slot-label">Ad space</span>
          </AdFrame>
        </aside>
      </div>

      <footer className="site-footer">
        <p className="footer-note-large">
          Probabilities are produced by 100,000 Monte Carlo simulations per
          matchup, grounded in the market line. The free/locked gating above
          is based on whether you&apos;re signed in.
        </p>
      </footer>
    </>
  );
}
