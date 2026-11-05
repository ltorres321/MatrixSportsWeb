import Link from "next/link";

// NBA sibling of ../loading.tsx -- see that file's header for why this
// exists. Markup matches NbaParlaysView.tsx's own header/chips exactly.
export default function NbaParlaysLoading() {
  return (
    <>
      <header className="site-header">
        <h1 className="glow">NBA PARLAYS</h1>
        <p className="subtitle">{"// our model's 6 best-probability parlays for every day, graded Sunday to Saturday"}</p>
      </header>

      <div className="league-chips" aria-label="Sport selector">
        <Link href="/parlays" className="league-chip">
          NFL
        </Link>
        <button className="league-chip active" type="button">
          NBA
        </button>
      </div>

      <main>
        <div className="stat-section">
          <div className="lineup-unavailable">Loading this week&apos;s parlays…</div>
        </div>
      </main>
    </>
  );
}
