import Link from "next/link";
import { getPublishedStories, getPublishedPerformanceReviews } from "@/lib/stories";
import AdFrame from "@/components/AdFrame";
import MobileAdFrame from "@/components/MobileAdFrame";
import AdUnit from "@/components/AdUnit";

export const metadata = {
  title: "Game Recaps & Analysis — Matrix Sports Analytics",
  description:
    "Every NFL game recap and weekly model performance review published on Matrix Sports Analytics, newest first.",
};

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

// No artificial cap -- this page's whole purpose is to be the place
// that shows the full body of published work, not a curated slice of
// it like the home page's rotating cards. 500 is just a sane ceiling
// well above anything the site will publish in a season.
const ARCHIVE_LIMIT = 500;

export default async function StoriesArchivePage() {
  const [gameStories, performanceReviews] = await Promise.all([
    getPublishedStories(ARCHIVE_LIMIT),
    getPublishedPerformanceReviews(ARCHIVE_LIMIT),
  ]);

  const entries = [...gameStories, ...performanceReviews].sort((a, b) => {
    const aTime = a.published_at ? new Date(a.published_at).getTime() : 0;
    const bTime = b.published_at ? new Date(b.published_at).getTime() : 0;
    return bTime - aTime;
  });

  return (
    <>
      <header className="site-header">
        <h1 className="glow">GAME RECAPS &amp; ANALYSIS</h1>
        <p className="subtitle">{"// every recap and model performance review we've published"}</p>
      </header>

      <div className="content-split">
        <aside className="promo-rail promo-rail-left" aria-label="Promotional space">
          <AdFrame>
            <AdUnit kind="rail" />
            <span className="slot-label">Ad space</span>
          </AdFrame>
          <AdFrame>
            <AdUnit kind="rail" />
            <span className="slot-label">Ad space</span>
          </AdFrame>
        </aside>

        <main className="content-main">
          {entries.length === 0 ? (
            <p style={{ textAlign: "center", color: "var(--text-dim)" }}>
              No recaps published yet -- check back once this week&apos;s games are final.
            </p>
          ) : (
            <>
              <div className="news-grid">
                {entries.map((story) => {
                  const href = story.universal_game_id ? `/game/${story.universal_game_id}` : `/stories/${story.id}`;
                  const image = story.universal_game_id ? `/game/${story.universal_game_id}/opengraph-image` : null;
                  const linkLabel = story.universal_game_id ? "View Game →" : "Read More →";

                  return (
                    <Link key={story.id} className="news-card" href={href}>
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element -- generated route, not a static asset next/image can optimize
                        <img className="news-card-image" src={image} alt="" />
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
                })}
              </div>

              <div className="mobile-ad-wrap" aria-label="Promotional space">
                <MobileAdFrame>
                  <AdUnit kind="mobile" />
                  <span className="slot-label">Ad space</span>
                </MobileAdFrame>
              </div>
            </>
          )}
        </main>

        <aside className="promo-rail promo-rail-right" aria-label="Promotional space">
          <AdFrame>
            <AdUnit kind="rail" />
            <span className="slot-label">Ad space</span>
          </AdFrame>
          <AdFrame>
            <AdUnit kind="rail" />
            <span className="slot-label">Ad space</span>
          </AdFrame>
        </aside>
      </div>
    </>
  );
}
