import { NextResponse } from "next/server";
import { isAuthorizedContentJob } from "@/lib/contentJobAuth";
import { getAvailableSeasons, getDefaultWeek, getCurrentSeasonYear } from "@/lib/predictions";
import { getLeagueBettingEdge } from "@/lib/pffBettingEdge";
import { buildLeagueParlays } from "@/lib/leagueParlayHelper";
import type { Parlay } from "@/lib/parlayHelper";
import {
  renderParlayCard,
  renderParlayCardSquare,
  renderParlayCardFacebook,
} from "@/lib/social/renderParlayCard";
import { parlayCaption, PLATFORMS } from "@/lib/social/captions";

// Machine-to-machine endpoint for the standalone content-generation
// jobs in /home/neo/SportsContentCreation -- see contentJobAuth.ts.
// Deliberately the SAME auth gate (and only that gate) as every other
// content-jobs/* route -- getLeagueBettingEdge is the exact query that
// caused the 2026-10-10 production outage when /parlays was reachable
// by anonymous/bot traffic (see app/parlays/page.tsx's SignUpGate
// comment). This route was never reachable by that traffic in the
// first place (bearer-token auth, not a public page), so it doesn't
// reproduce that failure mode -- but it's still the same expensive
// query, so this must only ever be called by a scheduled script
// polling WEEKLY (parlays don't change mid-week), never on a tight
// poll loop the way the premier-game route's 30-minute cron is.
export async function GET(request: Request) {
  if (!isAuthorizedContentJob(request)) {
    return new NextResponse("Not authorized", { status: 403 });
  }

  const seasons = await getAvailableSeasons();
  const season = await getCurrentSeasonYear();
  const activeSeason = seasons.includes(season) ? season : (seasons[0] ?? season);
  const week = await getDefaultWeek(activeSeason);

  if (week === null) {
    return NextResponse.json({ error: "No active week found" }, { status: 404 });
  }

  const playerProps = await getLeagueBettingEdge(activeSeason, week);
  const leagueParlays = buildLeagueParlays(playerProps, "single");

  // Best 2-leg parlay is the featured pick -- the safer, higher-
  // probability of the two shapes the page offers (see
  // leagueParlayHelper.ts's LEAGUE_THREE_LEG_COUNT <= LEAGUE_TWO_LEG_COUNT
  // design rule), same "lead with the more confident pick" reasoning as
  // the premier game rotation picking one single game. Falls back to the
  // best 3-leg only if no 2-leg parlay could be built at all (e.g. too
  // few distinct players with a graded prop this week).
  const featured: Parlay | null = leagueParlays.twoLeg[0] ?? leagueParlays.threeLeg[0] ?? null;

  if (!featured) {
    return NextResponse.json({ error: `No parlay could be built for ${activeSeason} week ${week}` }, { status: 404 });
  }

  const [imageResponse, imageSquareResponse, imageFacebookResponse] = await Promise.all([
    renderParlayCard(featured),
    renderParlayCardSquare(featured),
    renderParlayCardFacebook(featured),
  ]);
  const [imageBuffer, imageSquareBuffer, imageFacebookBuffer] = await Promise.all([
    imageResponse.arrayBuffer().then(Buffer.from),
    imageSquareResponse.arrayBuffer().then(Buffer.from),
    imageFacebookResponse.arrayBuffer().then(Buffer.from),
  ]);

  const captions = Object.fromEntries(PLATFORMS.map((p) => [p, parlayCaption(activeSeason, week, featured, p)])) as Record<
    (typeof PLATFORMS)[number],
    string
  >;

  // Stable identifier for the SPECIFIC parlay picked, not just the
  // week -- lines can move mid-week and change which legs are
  // actually the best value, and runParlayJob.ts needs to tell "same
  // parlay, nothing to regenerate" apart from "same week, but a
  // genuinely different pick now" rather than deduping on week alone.
  const parlayKey = featured.legs
    .map((leg) => `${leg.entry.playerName}-${leg.entry.consensusStat}-${leg.entry.pickSide}-${leg.entry.pickLine}`)
    .join("|");

  return NextResponse.json({
    season: activeSeason,
    week,
    weekKey: `${activeSeason}-w${week}`,
    parlayKey,
    captions,
    imageBase64: imageBuffer.toString("base64"),
    imageSquareBase64: imageSquareBuffer.toString("base64"),
    imageFacebookBase64: imageFacebookBuffer.toString("base64"),
  });
}
