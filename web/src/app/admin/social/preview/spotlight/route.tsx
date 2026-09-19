import { NextResponse } from "next/server";
import { getCurrentAdminUserId } from "@/lib/admin";
import { getCurrentSpotlightMatchup } from "@/lib/social/currentSpotlight";
import { renderSpotlightCard } from "@/lib/social/renderSpotlightCard";

export async function GET() {
  const adminUserId = await getCurrentAdminUserId();
  if (!adminUserId) {
    return new NextResponse("Not authorized", { status: 403 });
  }

  const matchup = await getCurrentSpotlightMatchup();
  if (!matchup) {
    return new NextResponse("No premier game found for the current week", { status: 404 });
  }

  return renderSpotlightCard(matchup);
}
