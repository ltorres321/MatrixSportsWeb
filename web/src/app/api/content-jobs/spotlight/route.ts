import { NextResponse } from "next/server";
import { isAuthorizedContentJob } from "@/lib/contentJobAuth";
import { getCurrentSpotlightMatchup } from "@/lib/social/currentSpotlight";
import { renderSpotlightCard } from "@/lib/social/renderSpotlightCard";
import { spotlightCaption } from "@/lib/social/captions";

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

  const matchup = await getCurrentSpotlightMatchup();
  if (!matchup) {
    return NextResponse.json({ error: "No premier game found for the current week" }, { status: 404 });
  }

  const imageResponse = await renderSpotlightCard(matchup);
  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

  return NextResponse.json({
    gameId: matchup.id,
    day: dayAbbrFromKickoff(matchup.kickoff),
    caption: spotlightCaption(matchup),
    imageBase64: imageBuffer.toString("base64"),
  });
}
