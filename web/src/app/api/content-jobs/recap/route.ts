import { NextResponse } from "next/server";
import { isAuthorizedContentJob } from "@/lib/contentJobAuth";
import { getMostRecentCompletedWeek } from "@/lib/social/recentCompletedWeek";
import { getWeekRecord } from "@/lib/social/weeklyStats";
import { renderRecapCard } from "@/lib/social/renderRecapCard";
import { recapCaption } from "@/lib/social/captions";

// Machine-to-machine endpoint for the standalone content-generation
// jobs in /home/neo/SportsContentCreation -- see contentJobAuth.ts.
export async function GET(request: Request) {
  if (!isAuthorizedContentJob(request)) {
    return new NextResponse("Not authorized", { status: 403 });
  }

  const completed = await getMostRecentCompletedWeek();
  if (!completed) {
    return NextResponse.json({ error: "No completed week found yet" }, { status: 404 });
  }

  const record = getWeekRecord(completed.matchups);
  const imageResponse = await renderRecapCard(completed.season, completed.week, record);
  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

  return NextResponse.json({
    weekKey: `${completed.season}-w${completed.week}`,
    season: completed.season,
    week: completed.week,
    caption: recapCaption(completed.season, completed.week, completed.matchups),
    imageBase64: imageBuffer.toString("base64"),
  });
}
