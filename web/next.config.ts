import type { NextConfig } from "next";

// Next.js only sends a fully-resolved <head> (title, meta description,
// canonical, OG tags) to user agents matching this pattern -- everyone
// else gets a minimal initial shell with the real metadata streamed
// into the body afterward (fine for a real browser, which moves it
// into <head> client-side once hydrated). Next's own built-in default
// list only covers legacy search/social crawlers (Googlebot variants,
// Bingbot, facebookexternalhit, Twitterbot, ...) -- it does NOT
// include any of the AI crawlers that actually matter for GEO
// (GPTBot, ClaudeBot, PerplexityBot, etc.), none of which execute JS.
// Setting this REPLACES Next's default list rather than extending it,
// so the full default pattern is reproduced here with AI crawlers
// appended -- otherwise Bingbot/Twitterbot/etc. would regress.
const HTML_LIMITED_BOTS =
  /[\w-]+-Google|Google-[\w-]+|GoogleOther|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight|GPTBot|ChatGPT-User|OAI-SearchBot|ClaudeBot|Claude-Web|Claude-SearchBot|anthropic-ai|PerplexityBot|Perplexity-User|CCBot|Amazonbot|Bytespider|Applebot-Extended|Meta-ExternalAgent|meta-externalfetcher|Diffbot|YouBot|cohere-ai|ImagesiftBot|Timpibot|SemrushBot|AhrefsBot/i;

const nextConfig: NextConfig = {
  // Lets the dev server's JS/HMR bundle load when this box is reached
  // over the LAN by IP (e.g. from another device) instead of
  // localhost -- without this, only the static HTML shell loads and
  // everything client-side (the rain canvas, the nav, the Google
  // button) silently fails.
  allowedDevOrigins: ["192.168.1.101"],
  htmlLimitedBots: HTML_LIMITED_BOTS,
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
