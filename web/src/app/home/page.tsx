"use client";

import { useState } from "react";
import Link from "next/link";
import { useMemberPreview } from "@/lib/useMemberPreview";
import { getSeasons, getCurrentSeasonYear, WEEKS, CURRENT_WEEK } from "@/lib/matchups";
import MatchupCard from "@/components/MatchupCard";

const SEASONS = getSeasons();
const CURRENT_SEASON_YEAR = getCurrentSeasonYear();
const SEASON_YEARS = Object.keys(SEASONS).map(Number).sort((a, b) => b - a);

export default function PredictionsPage() {
  const { isMember, toggle } = useMemberPreview();
  const [activeSeason, setActiveSeason] = useState(CURRENT_SEASON_YEAR);
  const [activeWeek, setActiveWeek] = useState(CURRENT_WEEK);

  const season = SEASONS[activeSeason];
  const premier = season.matchups.find((m) => m.premier);
  const rest = season.matchups.filter((m) => !m.premier);
  const locked = !isMember;

  return (
    <>
      <header className="site-header">
        <h1 className="glow">
          {activeSeason} SEASON — WEEK {activeWeek} PREDICTIONS
        </h1>
        <p className="subtitle">{"// AI-simulated win probabilities for every NFL matchup"}</p>
        <div className="demo-flag">DEMO DATA — NOT CONNECTED TO THE MODEL</div>
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
        {SEASON_YEARS.map((year) => (
          <button
            key={year}
            type="button"
            className={`week-pill ${year === activeSeason ? "active" : ""}`}
            onClick={() => setActiveSeason(year)}
          >
            {year}
          </button>
        ))}
      </nav>

      <nav className="week-rail" aria-label="Week selector">
        {WEEKS.map((w) => (
          <button
            key={w}
            type="button"
            className={`week-pill ${w === activeWeek ? "active" : ""}`}
            onClick={() => setActiveWeek(w)}
          >
            WK {w}
          </button>
        ))}
      </nav>

      <main>
        <div className="premier-wrap">
          <div className="premier-ribbon">
            {season.current ? "★ GAME OF THE WEEK — FREE PREVIEW" : "★ FEATURED GAME — FREE PREVIEW"}
          </div>
          {premier && <MatchupCard matchup={premier} premier />}
        </div>

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

        <div className="dev-toggle">
          <button type="button" onClick={toggle}>
            testing: toggle member view
          </button>
        </div>
      </main>

      <footer className="site-footer">
        <p>
          Layout &amp; look-and-feel prototype only. Probabilities shown are
          placeholder values for design purposes and are not produced by the
          prediction model. The free/locked gating above is real — based on
          whether you&apos;re signed in — but the underlying numbers are not.
        </p>
      </footer>
    </>
  );
}
