import { NextResponse } from "next/server";
import { getCurrentAdminUserId } from "@/lib/admin";
import { getMostRecentCompletedWeek } from "@/lib/social/recentCompletedWeek";
import { pickWeeklyInsight } from "@/lib/social/weeklyStats";
import { renderInsightCard } from "@/lib/social/renderInsightCard";

export async function GET() {
  const adminUserId = await getCurrentAdminUserId();
  if (!adminUserId) {
    return new NextResponse("Not authorized", { status: 403 });
  }

  const completed = await getMostRecentCompletedWeek();
  if (!completed) {
    return new NextResponse("No completed week found yet", { status: 404 });
  }

  const insight = pickWeeklyInsight(completed.matchups);
  if (!insight) {
    return new NextResponse("No insight available for the most recent completed week", { status: 404 });
  }

  return renderInsightCard(insight);
}
