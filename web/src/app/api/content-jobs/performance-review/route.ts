import { NextResponse } from "next/server";
import { isAuthorizedContentJob } from "@/lib/contentJobAuth";
import { getLatestPerformanceReview } from "@/lib/stories";
import { performanceReviewCaption, PLATFORMS } from "@/lib/social/captions";

// Machine-to-machine endpoint for the standalone content-generation
// jobs in /home/neo/SportsContentCreation -- see contentJobAuth.ts.
// Deliberately text-only (no image, unlike spotlight/recap) -- this
// content type was only ever asked to produce post captions, not a
// rendered card.
//
// Only ever returns a PUBLISHED review -- SportsLLM (a separate repo)
// writes these as drafts; a story sitting unreviewed at
// /admin/stories is invisible here too, same gate as the public
// /stories/[id] page.
export async function GET(request: Request) {
  if (!isAuthorizedContentJob(request)) {
    return new NextResponse("Not authorized", { status: 403 });
  }

  const story = await getLatestPerformanceReview();
  if (!story) {
    return NextResponse.json({ error: "No published weekly performance review found yet" }, { status: 404 });
  }

  const captions = Object.fromEntries(
    PLATFORMS.map((p) => [p, performanceReviewCaption(story, p)])
  ) as Record<(typeof PLATFORMS)[number], string>;

  return NextResponse.json({
    storyId: story.id,
    season: story.season,
    week: story.week,
    headline: story.headline,
    captions,
  });
}
