"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
// formatNbaDateLabel/formatNbaMonthLabel come from matchups.ts, NOT
// nbaPredictions.ts -- see matchups.ts's own header for why a client
// component (this file) can't import anything from the server-only
// one, even a pure formatter with no DB access.
import type { Matchup } from "@/lib/matchups";
import { formatNbaDateLabel, formatNbaMonthLabel } from "@/lib/matchups";
import NbaMatchupCard from "@/components/NbaMatchupCard";
import { useMemberPreview, SHOW_MEMBER_PREVIEW_TOGGLE } from "@/lib/useMemberPreview";

// NBA equivalent of PredictionsView.tsx, deliberately smaller: no ad
// frames (orthogonal to "show win probabilities," not part of this
// first slice -- see src4/FINDINGS.md), no premier-game highlight.
// Same league-chips row as PredictionsView, now actually functional
// (NFL/NBA are both real links) instead of the commented-out "COMING
// SOON" placeholder it replaces.
//
// Member-preview paywall added 2026-10-25 (request: signed-out
// visitors could see every NBA game here, unlike the NFL slate where
// only the premier game is free) -- same .locked-section/.unlock-panel
// treatment as PredictionsView.tsx, just with no premier game to
// carve out of the locked set: NBA has no premier-game concept yet
// (see nbaPredictions.ts's module header), so every game on this page
// is locked for a non-member, full stop.
//
// LIVE-SCORE POLLING now mirrors PredictionsView.tsx (NFL) too --
// nbaPredictions.ts/nbaSchedule.ts already support a real "live"
// status (added for the single-game page first), this view just
// never re-fetched while one was on screen, so a live score sat
// frozen until a manual reload -- confirmed live: real games in
// progress stayed on the page's last-fetched snapshot.
const LIVE_REFRESH_MS = 20_000;

export default function NbaPredictionsView({
  seasons,
  season,
  months,
  activeMonth,
  dates,
  activeDate,
  matchups,
}: {
  seasons: number[];
  season: number | null;
  months: string[];
  activeMonth: string | null;
  dates: string[];
  activeDate: string | null;
  matchups: Matchup[];
}) {
  const { isMember, toggle } = useMemberPreview();
  const router = useRouter();
  const hasLiveGame = matchups.some((m) => m.status === "live");
  const locked = !isMember;

  useEffect(() => {
    if (!hasLiveGame) return;
    const interval = setInterval(() => router.refresh(), LIVE_REFRESH_MS);
    return () => clearInterval(interval);
  }, [hasLiveGame, router]);

  if (season === null || activeDate === null) {
    return (
      <>
        <header className="site-header">
          <h1 className="glow">NBA PREDICTIONS</h1>
          <p className="subtitle">{"// no model output yet"}</p>
        </header>
        <main>
          <p style={{ textAlign: "center", color: "var(--text-dim)" }}>
            No NBA predictions have been generated yet. Run src4/26_predict_upcoming_games.py
            against the shared database, then reload this page.
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <header className="site-header">
        <h1 className="glow">
          {season} SEASON — {formatNbaDateLabel(activeDate)}
        </h1>
        <p className="subtitle">{"// AI-simulated win probabilities for every NBA matchup"}</p>
      </header>

      <div className="league-chips" aria-label="Sport selector">
        <Link href="/home" className="league-chip">
          NFL
        </Link>
        <button className="league-chip active" type="button">
          NBA
        </button>
      </div>

      {/* Same 3-season browsing NFL's PredictionsView.tsx already has
          -- src4/38_backfill_historical_seasons.py is what makes
          2025-26/2024-25 real rows to switch TO, this is the nav that
          was always missing even before that (there was nothing to
          render a season-rail FROM until the backfill, but the UI gap
          existed independently and needed fixing either way). */}
      {seasons.length > 1 && (
        <nav className="season-rail" aria-label="Season selector">
          {seasons.map((year) => (
            <Link
              key={year}
              href={`/home/nba?season=${year}`}
              className={`week-pill ${year === season ? "active" : ""}`}
            >
              {year}
            </Link>
          ))}
        </nav>
      )}

      {/* A full NBA season is ~180 playing days -- too many for one
          horizontal rail to browse (the actual complaint this was
          added for). Narrows the day-rail below to one calendar
          month at a time instead of scrapping it -- "keep the days
          as is" was the explicit ask, so the day-tab markup itself is
          unchanged, only which dates reach it. */}
      {months.length > 1 && (
        <nav className="month-rail" aria-label="Month selector">
          {months.map((m) => (
            <Link
              key={m}
              href={`/home/nba?season=${season}&month=${m}`}
              className={`week-pill ${m === activeMonth ? "active" : ""}`}
            >
              {formatNbaMonthLabel(m)}
            </Link>
          ))}
        </nav>
      )}

      <nav className="week-rail" aria-label="Date selector">
        {dates.map((d) => (
          <Link
            key={d}
            // season (and month, so switching date never drops which
            // month tab is active) ALWAYS carried forward -- this link
            // used to be just `?date=${d}`, which silently dropped
            // whatever season was active and fell back to the current
            // one. Confirmed live: picking 2026-03-14 while on the
            // 2025-26 season landed on today's date instead, because
            // the current season has no March 2026 to find it in.
            href={`/home/nba?season=${season}&month=${activeMonth}&date=${d}`}
            className={`week-pill ${d === activeDate ? "active" : ""}`}
          >
            {formatNbaDateLabel(d)}
          </Link>
        ))}
      </nav>

      <main>
        {matchups.length === 0 ? (
          <p style={{ textAlign: "center", color: "var(--text-dim)" }}>
            No NBA games predicted for this date.
          </p>
        ) : (
          <div className={`locked-section ${locked ? "is-locked" : ""}`}>
            <div className="matchup-grid">
              {matchups.map((m) => (
                <NbaMatchupCard key={m.id} matchup={m} />
              ))}
            </div>
            {locked && (
              <div className="unlock-panel">
                <div className="unlock-card">
                  <span className="lock-icon">🔒</span>
                  <h2>Unlock the Full Slate</h2>
                  <p>
                    Create a free account to see win probabilities for every
                    NBA game — no credit card required.
                  </p>
                  <Link className="btn btn-primary btn-block" href="/signup">
                    Sign Up Free
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}

        {SHOW_MEMBER_PREVIEW_TOGGLE && (
          <div className="dev-toggle">
            <button type="button" onClick={toggle}>
              testing: toggle member view
            </button>
          </div>
        )}
      </main>
    </>
  );
}
