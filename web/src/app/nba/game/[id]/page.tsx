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

export default async function NbaGamePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string; hideBanned?: string }>;
}) {
  const { id } = await params;
  const { view, hideBanned } = await searchParams;
  const game = await getNbaGameDetail(id, hideBanned !== "0");

  if (!game) {
    return (
      <main>
        <p style={{ textAlign: "center", color: "var(--text-dim)" }}>
          Game not found.
        </p>
      </main>
    );
  }

  // ?view=radar -- deep link straight into the Matchups tab's Radar
  // Chart mode, for social/promo links that want to drop someone right
  // on the chart instead of the default Overview tab. See
  // NbaGameDetailView.tsx's own initialView prop.
  return <NbaGameDetailView game={game} initialView={view === "radar" ? "radar" : undefined} />;
}
