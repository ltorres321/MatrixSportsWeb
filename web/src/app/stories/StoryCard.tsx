import Link from "next/link";
import type { Story } from "@/lib/stories";

// Shared by page.tsx (server-rendered first batch) and
// StoriesInfiniteList.tsx (client-rendered batches loaded on scroll) --
// no "use client" directive needed here itself; a plain component like
// this works from either a server or client parent.

// Home-page cards truncate to a teaser (see page.tsx's truncateTeaser);
// this archive is the same idea, just listing everything published
// instead of the 3-6 most recent. Cuts at the last whole word rather
// than mid-word for the same reason page.tsx's version does.
function truncateTeaser(text: string, maxChars = 200): string {
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : maxChars)}…`;
}

export default function StoryCard({ story }: { story: Story }) {
  const href = story.universal_game_id ? `/game/${story.universal_game_id}` : `/stories/${story.id}`;
  const image = story.universal_game_id ? `/game/${story.universal_game_id}/opengraph-image` : null;
  const linkLabel = story.universal_game_id ? "View Game →" : "Read More →";

  return (
    <Link className="news-card" href={href}>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- generated route, not a static asset next/image can optimize
        <img className="news-card-image" src={image} alt="" loading="lazy" />
      ) : (
        <div className="news-card-image news-card-image-fallback">📊</div>
      )}
      <div className="news-card-body">
        <h3>{story.headline}</h3>
        <p>{truncateTeaser(story.body)}</p>
        <span className="read-more">{linkLabel}</span>
      </div>
    </Link>
  );
}
