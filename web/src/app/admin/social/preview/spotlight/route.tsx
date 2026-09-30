import { NextResponse } from "next/server";
import { getCurrentAdminUserId } from "@/lib/admin";
import { getCurrentSpotlightMatchup, getSpotlightMatchupById } from "@/lib/social/currentSpotlight";
import { renderSpotlightCard } from "@/lib/social/renderSpotlightCard";

export async function GET(request: Request) {
  const adminUserId = await getCurrentAdminUserId();
  if (!adminUserId) {
    return new NextResponse("Not authorized", { status: 403 });
  }

  // ?game=<universal_game_id>: preview a specific game's spotlight
  // instead of whatever getPremierGame() currently has auto-selected
  // -- see getSpotlightMatchupById's comment for why.
  const gameIdOverride = new URL(request.url).searchParams.get("game");
  const matchup = gameIdOverride
    ? await getSpotlightMatchupById(gameIdOverride)
    : await getCurrentSpotlightMatchup();
  if (!matchup) {
    return new NextResponse(
      gameIdOverride ? `No matchup found for ${gameIdOverride}` : "No premier game found for the current week",
      { status: 404 }
    );
  }

  return renderSpotlightCard(matchup);
}
