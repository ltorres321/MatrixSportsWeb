import type { NextConfig } from "next";

// Next.js only sends a fully-resolved <head> (title, meta description,
// canonical, OG tags) to user agents matching this pattern -- everyone
// else gets a minimal initial shell with the real metadata streamed
// into the body afterward (fine for a real browser, which moves it
// into <head> client-side once hydrated).
//
// This used to be a curated list: Next's own default (Googlebot
// variants, Bingbot, facebookexternalhit, Twitterbot, ...) plus the
// AI crawlers that actually matter for GEO (GPTBot, ClaudeBot,
// PerplexityBot, etc.). That approach is fundamentally unreliable for
// a site whose whole growth strategy is being found by crawlers --
// proof: trychad.ai's own GEO-audit scanner, the tool this project
// uses to check that exact thing, was STILL seeing an empty <head> on
// game/story pages after that list shipped, because its own user
// agent was never on the list (and there's no way to enumerate every
// crawler, present or future, that matters for this). Matching every
// user agent is the only version of this that can't go stale.
const HTML_LIMITED_BOTS = /.*/;

const nextConfig: NextConfig = {
  // Lets the dev server's JS/HMR bundle load when this box is reached
  // over the LAN by IP (e.g. from another device) instead of
  // localhost -- without this, only the static HTML shell loads and
  // everything client-side (the rain canvas, the nav, the Google
  // button) silently fails.
  allowedDevOrigins: ["192.168.1.101"],
  htmlLimitedBots: HTML_LIMITED_BOTS,
  // Found live: clicking a date tab on /home/nba (or /home) after
  // switching season/week landed back on today's/the current week's
  // data instead of the one just picked. Confirmed it wasn't a page
  // logic bug -- curling the exact same URL server-side always
  // returned the correct page; only actual <Link> navigation in the
  // browser showed the stale one. That's the client Router Cache:
  // App Router caches a dynamically-rendered page's RSC payload
  // per-URL across client-side navigations, and both predictions
  // pages read searchParams on every request (season/week/month/date
  // can all change what's shown), so the cached response for a URL
  // visited minutes ago is wrong by the time it's revisited. Setting
  // this to 0 makes every client-side navigation to a dynamic page
  // re-fetch instead of reusing a stale cached entry -- exactly what
  // a live-scores/predictions site needs; the caching this disables
  // was never appropriate for pages whose whole content is "which
  // games for which date," which changes on every param.
  experimental: {
    staleTimes: {
      dynamic: 0,
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
