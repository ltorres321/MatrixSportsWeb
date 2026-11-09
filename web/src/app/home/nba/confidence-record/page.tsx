import Link from "next/link";
import { getAvailableNbaSeasons, getNbaConfidenceRecord, getNbaConfidenceGames } from "@/lib/nbaPredictions";
import NbaMatchupCard from "@/components/NbaMatchupCard";
import { pageMetadata } from "@/lib/seo";

// NBA sibling of /home/confidence-record (NFL) -- the games behind an
// NBA confidence tile (user, 2026-11-09: "Can we do the same for
// basketball now?"). No "week" for NBA -- grouped by date instead,
// same convention NbaParlaysView.tsx and the rest of the NBA UI use.
export const metadata = pageMetadata({
  title: "NBA Model Confidence Record — Matrix Sports Analytics",
  description: "Every NBA game this season where the model picked a side at 70%+ or 80%+ confidence, and how it turned out.",
  path: "/home/nba/confidence-record",
});

export default async function NbaConfidenceRecordPage({
  searchParams,
}: {
  searchParams: Promise<{ min?: string }>;
}) {
  const { min } = await searchParams;
  const minProb = min === "80" ? 0.8 : 0.7;
  const thresholdPct = minProb === 0.8 ? 80 : 70;

  const seasons = await getAvailableNbaSeasons();
  const season = seasons[0];

  if (season === undefined) {
    return (
      <>
        <header className="site-header">
          <h1 className="glow">NBA MODEL RECORD AT {thresholdPct}%+ CONFIDENCE</h1>
        </header>
        <main>
          <p style={{ textAlign: "center", color: "var(--text-dim)" }}>No graded games yet.</p>
        </main>
      </>
    );
  }

  const [record, games] = await Promise.all([
    getNbaConfidenceRecord(season, minProb),
    getNbaConfidenceGames(season, minProb),
  ]);
  const total = record.wins + record.losses;
  const pct = total > 0 ? ((record.wins / total) * 100).toFixed(1) : "0.0";

  return (
    <>
      <header className="site-header">
        <h1 className="glow">NBA MODEL RECORD AT {thresholdPct}%+ CONFIDENCE</h1>
        <p className="subtitle">
          {"// "}
          {record.wins}-{record.losses} ({pct}%) so far this season
        </p>
      </header>

      <main>
        {games.length === 0 ? (
          <p style={{ textAlign: "center", color: "var(--text-dim)" }}>
            No graded games at this confidence level yet.
          </p>
        ) : (
          <div className="matchup-grid">
            {games.map(({ matchup }) => (
              <NbaMatchupCard key={matchup.id} matchup={matchup} />
            ))}
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: "2rem" }}>
          <Link className="btn btn-ghost" href="/">
            ← Back to Dashboard
          </Link>
        </div>
      </main>
    </>
  );
}
