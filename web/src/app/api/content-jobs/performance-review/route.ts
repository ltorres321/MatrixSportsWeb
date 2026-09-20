import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { isAuthorizedContentJob } from "@/lib/contentJobAuth";
import { getLatestPerformanceReview } from "@/lib/stories";
import { performanceReviewCaption, PLATFORMS } from "@/lib/social/captions";
import { accuracyPctFromStory, performanceTierImagePath } from "@/lib/performanceTier";

// Machine-to-machine endpoint for the standalone content-generation
// jobs in /home/neo/SportsContentCreation -- see contentJobAuth.ts.
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

  // One of the three tier images (public/assets/icons/), same one the
  // article page itself shows -- read straight off disk and
  // base64-encoded, same shape spotlight/recap already return
  // (imageBase64), so SportsContentCreation's job can use the same
  // writePostFolder() as those instead of a text-only variant.
  const accuracyPct = accuracyPctFromStory(story);
  let imageBase64: string | null = null;
  if (accuracyPct !== null) {
    const imagePath = performanceTierImagePath(accuracyPct);
    const fileBuffer = await readFile(path.join(process.cwd(), "public", imagePath));
    imageBase64 = fileBuffer.toString("base64");
  }

  return NextResponse.json({
    storyId: story.id,
    season: story.season,
    week: story.week,
    headline: story.headline,
    captions,
    imageBase64,
  });
}
