import { getNbaGameDetail } from "@/lib/nbaGameDetail";
import NbaGameDetailView from "./NbaGameDetailView";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const game = await getNbaGameDetail(id);
  if (!game) return {};
  return pageMetadata({
    title: `${game.awayTeamName} @ ${game.homeTeamName} — Matrix Sports Analytics`,
    description: `NBA matchup, betting edge, and parlay helper for ${game.awayTeamName} at ${game.homeTeamName}.`,
    path: `/nba/game/${id}`,
  });
}

export default async function NbaGamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const game = await getNbaGameDetail(id);

  if (!game) {
    return (
      <main>
        <p style={{ textAlign: "center", color: "var(--text-dim)" }}>
          Game not found.
        </p>
      </main>
    );
  }

  return <NbaGameDetailView game={game} />;
}
