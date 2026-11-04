import Link from "next/link";

// Next.js route-level instant loading UI: shown immediately on
// navigation, before ParlaysPage's server component has even started
// awaiting its (now cached, but still real on a cache miss) DB query --
// without this the browser just sits on a blank/previous page for the
// full query time with no feedback at all, which is what read as "hung."
// Header/chips markup matches ParlaysView.tsx's own exactly so the swap
// from this to the real page looks like a continuation, not a flash.
export default function ParlaysLoading() {
  return (
    <>
      <header className="site-header">
        <h1 className="glow">PARLAYS</h1>
        <p className="subtitle">{"// our model's 6 best-probability parlays, picked from every game each week"}</p>
      </header>

      <div className="league-chips" aria-label="Sport selector">
        <button className="league-chip active" type="button">
          NFL
        </button>
        <Link href="/parlays/nba" className="league-chip">
          NBA
        </Link>
      </div>

      <main>
        <div className="stat-section">
          <div className="lineup-unavailable">Loading this week&apos;s parlays…</div>
        </div>
      </main>
    </>
  );
}
