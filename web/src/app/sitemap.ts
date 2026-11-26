import type { MetadataRoute } from "next";
import { getPublishedStories, getPublishedPerformanceReviews } from "@/lib/stories";
import { query } from "@/lib/db";

const BASE_URL = "https://matrixsports.net";

const ROUTES = ["", "/home", "/home/nba", "/parlays", "/stories", "/about", "/signup", "/login", "/contact", "/privacy", "/terms"];

// Individual /game/[id] and /stories/[id] pages weren't worth
// enumerating here while there was nothing much on them -- now every
// final game has a real published recap (see weekly-stories.mts), so
// leaving them out means Google can only find 34+ real content pages
// by crawling links rather than the sitemap telling it they exist
// directly. Capped well above anything a season will realistically
// produce, same reasoning as /stories's own ARCHIVE_LIMIT.
const CONTENT_LIMIT = 500;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();

  // No lastModified on static routes: stamping every one with the build
  // time claims they all changed on every deploy, which teaches Google
  // to ignore the field. Dynamic entries below carry real dates.
  const staticEntries = ROUTES.map((route) => ({
    url: `${BASE_URL}${route}`,
  }));

  // Next.js prerenders this route at build time, so a transient DB
  // hiccup (e.g. Supabase's pooler timing out a connection checkout
  // under concurrent build workers) would otherwise fail the ENTIRE
  // site build, not just the sitemap -- falling back to the static
  // routes keeps the build green; the dynamic entries just catch up
  // on the next successful build.
  let gameStories: Awaited<ReturnType<typeof getPublishedStories>> = [];
  let performanceReviews: Awaited<ReturnType<typeof getPublishedPerformanceReviews>> = [];
  try {
    [gameStories, performanceReviews] = await Promise.all([
      getPublishedStories(CONTENT_LIMIT),
      getPublishedPerformanceReviews(CONTENT_LIMIT),
    ]);
  } catch (err) {
    console.error("sitemap: DB unavailable at build time, falling back to static routes only", err);
  }

  // NBA game pages (/nba/game/[id]) -- every prediction row in the
  // current season has a page, so list them directly. Same build-safety
  // rule as above: a DB failure falls back to no NBA entries.
  let nbaEntries: MetadataRoute.Sitemap = [];
  try {
    const rows = await query<{ universal_game_id: string; game_date: Date }>(
      `SELECT universal_game_id, game_date FROM latest_nba_predictions
       WHERE season = (SELECT MAX(season) FROM latest_nba_predictions)
       ORDER BY game_date DESC LIMIT $1`,
      [CONTENT_LIMIT]
    );
    nbaEntries = rows.map((r) => ({
      url: `${BASE_URL}/nba/game/${r.universal_game_id}`,
      lastModified: new Date(r.game_date),
    }));
  } catch (err) {
    console.error("sitemap: NBA games unavailable at build time, skipping", err);
  }

  const gameEntries = gameStories
    .filter((story) => story.universal_game_id)
    .map((story) => ({
      url: `${BASE_URL}/game/${story.universal_game_id}`,
      lastModified: story.published_at ? new Date(story.published_at) : lastModified,
    }));

  const performanceReviewEntries = performanceReviews.map((story) => ({
    url: `${BASE_URL}/stories/${story.id}`,
    lastModified: story.published_at ? new Date(story.published_at) : lastModified,
  }));

  return [...staticEntries, ...gameEntries, ...nbaEntries, ...performanceReviewEntries];
}
