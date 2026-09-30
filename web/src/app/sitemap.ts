import type { MetadataRoute } from "next";
import { getPublishedStories, getPublishedPerformanceReviews } from "@/lib/stories";

const BASE_URL = "https://matrixsports.net";

const ROUTES = ["", "/home", "/stories", "/about", "/signup", "/login", "/contact", "/privacy", "/terms"];

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

  const staticEntries = ROUTES.map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified,
  }));

  const [gameStories, performanceReviews] = await Promise.all([
    getPublishedStories(CONTENT_LIMIT),
    getPublishedPerformanceReviews(CONTENT_LIMIT),
  ]);

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

  return [...staticEntries, ...gameEntries, ...performanceReviewEntries];
}
