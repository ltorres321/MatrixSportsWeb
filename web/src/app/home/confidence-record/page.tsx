import Link from "next/link";
import {
  getAvailableSeasons,
  getCurrentSeasonYear,
  getConfidenceRecord,
  getConfidenceGames,
} from "@/lib/predictions";
import MatchupCard from "@/components/MatchupCard";
import { pageMetadata } from "@/lib/seo";

// The games behind a home-dashboard confidence tile (user, 2026-11-09:
// "make each of these tiles active links to games that are counted in
// the record ... show the games with the final score and the
// percentage that was given at the time of creation"). NFL only for
// now -- NBA's equivalent waits on its own grading backfill landing.
export const metadata = pageMetadata({
  title: "NFL Model Confidence Record — Matrix Sports Analytics",
  description: "Every NFL game this season where the model picked a side at 70%+ or 80%+ confidence, and how it turned out.",
  path: "/home/confidence-record",
});

export default async function ConfidenceRecordPage({
  searchParams,
}: {
  searchParams: Promise<{ min?: string }>;
}) {
  const { min } = await searchParams;
  const minProb = min === "80" ? 0.8 : 0.7;
  const thresholdPct = minProb === 0.8 ? 80 : 70;

  const seasons = await getAvailableSeasons();
  const fallbackSeason = await getCurrentSeasonYear();
  const season = seasons.includes(fallbackSeason) ? fallbackSeason : seasons[0];

  if (season === undefined) {
    return (
      <>
        <header className="site-header">
          <h1 className="glow">NFL MODEL RECORD AT {thresholdPct}%+ CONFIDENCE</h1>
        </header>
        <main>
          <p style={{ textAlign: "center", color: "var(--text-dim)" }}>No graded games yet.</p>
        </main>
      </>
    );
  }

  const [record, games] = await Promise.all([
    getConfidenceRecord(season, minProb),
    getConfidenceGames(season, minProb),
  ]);
  const total = record.wins + record.losses;
  const pct = total > 0 ? ((record.wins / total) * 100).toFixed(1) : "0.0";

  return (
    <>
      <header className="site-header">
        <h1 className="glow">NFL MODEL RECORD AT {thresholdPct}%+ CONFIDENCE</h1>
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
              <MatchupCard key={matchup.id} matchup={matchup} />
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
