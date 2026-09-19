import { NextResponse } from "next/server";
import { getCurrentAdminUserId } from "@/lib/admin";
import { getMostRecentCompletedWeek } from "@/lib/social/recentCompletedWeek";
import { getWeekRecord } from "@/lib/social/weeklyStats";
import { renderRecapCard } from "@/lib/social/renderRecapCard";

export async function GET() {
  const adminUserId = await getCurrentAdminUserId();
  if (!adminUserId) {
    return new NextResponse("Not authorized", { status: 403 });
  }

  const completed = await getMostRecentCompletedWeek();
  if (!completed) {
    return new NextResponse("No completed week found yet", { status: 404 });
  }

  const record = getWeekRecord(completed.matchups);
  return renderRecapCard(completed.season, completed.week, record);
}
