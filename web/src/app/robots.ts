import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Signed-in-only / no-content-of-their-own pages -- nothing here
        // is worth a crawl budget or belongs in search results.
        disallow: ["/admin", "/profile", "/auth", "/forgot-password"],
      },
    ],
    sitemap: "https://matrixsports.net/sitemap.xml",
  };
}
