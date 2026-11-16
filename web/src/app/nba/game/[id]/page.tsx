import { getNbaGameDetail } from "@/lib/nbaGameDetail";
import { createClient } from "@/lib/supabase/server";
import { getUserEnabledBooks, booksExcludedByUserPref } from "@/lib/sportsbookPrefs";
import { getUserPropEdits } from "@/lib/propEdits";
import { getUserOddsFormat } from "@/lib/oddsFormatPrefs";
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
  // Anonymous visitors get userId undefined -> getUserEnabledBooks
  // returns [] -> no restriction, same as before this feature existed.
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const enabledBooks = await getUserEnabledBooks(supabase, userData.user?.id);
  const userExcludedBooks = booksExcludedByUserPref(enabledBooks);
  const propEdits = await getUserPropEdits(supabase, userData.user?.id);
  const oddsFormat = await getUserOddsFormat(supabase, userData.user?.id);
  // Default flipped to "show everything" (user, 2026-11-14) -- ?hideBanned=1 opts back in.
  const game = await getNbaGameDetail(id, hideBanned === "1", userExcludedBooks);

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
  return (
    <NbaGameDetailView
      game={game}
      initialView={view === "radar" ? "radar" : undefined}
      scope={`game:${id}`}
      propEdits={propEdits}
      oddsFormat={oddsFormat}
    />
  );
}
