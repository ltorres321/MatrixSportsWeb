import Parser from "rss-parser";

// Pulls headline + snippet + link from ESPN's own official NFL RSS
// feed -- per ESPN's published syndication terms (espn.com/espn/news/
// story?page=rssinfo), a site may display exactly what's in the feed
// as long as it links back to the full story on espn.com and credits
// ESPN. This does NOT reproduce full article text, and every card
// this powers must keep both the ESPN attribution and the outbound
// link -- that's the line between "legal aggregation" and
// infringement, not a formality.
//
// The feed itself has no images, so each item's thumbnail comes from
// fetching that article's own public og:image meta tag -- the same
// technique any link-preview (Slack, iMessage, Twitter) uses, not
// scraping the article body.

const ESPN_NFL_FEED = "https://www.espn.com/espn/rss/nfl/news";
const REVALIDATE_SECONDS = 1800; // 30 min -- don't hammer ESPN's feed or article pages every request

export interface NewsItem {
  title: string;
  snippet: string;
  link: string;
  pubDate: string;
  creator: string | null;
  image: string | null;
}

async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export async function getEspnNflNews(limit = 6): Promise<NewsItem[]> {
  const parser = new Parser();
  const res = await fetch(ESPN_NFL_FEED, {
    headers: { "User-Agent": "Mozilla/5.0" },
    next: { revalidate: REVALIDATE_SECONDS },
  });
  const xml = await res.text();
  const feed = await parser.parseString(xml);

  const items: NewsItem[] = (feed.items ?? []).slice(0, limit).map((item) => ({
    title: item.title ?? "",
    snippet: item.contentSnippet ?? item.content ?? "",
    link: item.link ?? "",
    pubDate: item.pubDate ?? "",
    creator: item.creator ?? null,
    image: null,
  }));

  // Best-effort thumbnails -- a failed fetch just means no image for
  // that card, never blocks the headline/snippet/link from showing.
  await Promise.all(
    items.map(async (item) => {
      if (item.link) item.image = await fetchOgImage(item.link);
    })
  );

  return items;
}
