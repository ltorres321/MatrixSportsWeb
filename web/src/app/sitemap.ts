import type { MetadataRoute } from "next";

const BASE_URL = "https://matrixsports.net";

// Static public routes only -- /game/[id] pages are per-matchup and
// change weekly, not worth enumerating here until there's a real need
// to get individual game pages indexed.
const ROUTES = ["", "/home", "/about", "/signup", "/login", "/contact", "/privacy", "/terms"];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return ROUTES.map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified,
  }));
}
