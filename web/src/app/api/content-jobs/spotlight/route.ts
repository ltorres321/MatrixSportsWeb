import { NextResponse } from "next/server";
import { isAuthorizedContentJob } from "@/lib/contentJobAuth";
import { getCurrentSpotlightMatchup, getSpotlightMatchupById } from "@/lib/social/currentSpotlight";
import { renderSpotlightCard, renderSpotlightCardSquare } from "@/lib/social/renderSpotlightCard";
import { spotlightCaption, PLATFORMS } from "@/lib/social/captions";

const DAY_ABBRS = new Set(["sun", "mon", "tue", "wed", "thu", "fri", "sat"]);

// matchup.kickoff is formatted like "Sun 8:20 PM ET" (see
// formatKickoff() in lib/predictions.ts) -- its first 3 chars are the
// day abbreviation this route needs for the content job's folder
// name. Falls back to today's real ET weekday only for the rare case
// where kickoff shows something else (e.g. "LIVE"), which the
// premier-game rotation can only hit during the brief "feature the
// Sunday night game" window -- by definition already a Sunday.
function dayAbbrFromKickoff(kickoff: string): string {
  const prefix = kickoff.slice(0, 3).toLowerCase();
  if (DAY_ABBRS.has(prefix)) return prefix;
  return new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "America/New_York" })
    .format(new Date())
    .toLowerCase();
}

// Machine-to-machine endpoint for the standalone content-generation
// jobs in /home/neo/SportsContentCreation -- see contentJobAuth.ts.
export async function GET(request: Request) {
  if (!isAuthorizedContentJob(request)) {
    return new NextResponse("Not authorized", { status: 403 });
  }

  // ?game=<universal_game_id>: a specific game instead of whatever
  // getPremierGame() currently has auto-selected -- see
  // getSpotlightMatchupById's comment for why this exists. Omitted
  // (the normal case), this is identical to before.
  const gameIdOverride = new URL(request.url).searchParams.get("game");
  const matchup = gameIdOverride
    ? await getSpotlightMatchupById(gameIdOverride)
    : await getCurrentSpotlightMatchup();
  if (!matchup) {
    return NextResponse.json(
      { error: gameIdOverride ? `No matchup found for ${gameIdOverride}` : "No premier game found for the current week" },
      { status: 404 }
    );
  }

  const [imageResponse, imageSquareResponse] = await Promise.all([
    renderSpotlightCard(matchup),
    renderSpotlightCardSquare(matchup),
  ]);
  const [imageBuffer, imageSquareBuffer] = await Promise.all([
    imageResponse.arrayBuffer().then(Buffer.from),
    imageSquareResponse.arrayBuffer().then(Buffer.from),
  ]);

  const captions = Object.fromEntries(PLATFORMS.map((p) => [p, spotlightCaption(matchup, p)])) as Record<
    (typeof PLATFORMS)[number],
    string
  >;

  return NextResponse.json({
    gameId: matchup.id,
    day: dayAbbrFromKickoff(matchup.kickoff),
    captions,
    imageBase64: imageBuffer.toString("base64"),
    imageSquareBase64: imageSquareBuffer.toString("base64"),
  });
}
