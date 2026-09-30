import Link from "next/link";
import { getPublishedStories, getPublishedPerformanceReviews, type Story } from "@/lib/stories";
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

function StoryCard({ story }: { story: Story }) {
  const href = story.universal_game_id ? `/game/${story.universal_game_id}` : `/stories/${story.id}`;
  const image = story.universal_game_id ? `/game/${story.universal_game_id}/opengraph-image` : null;
  const linkLabel = story.universal_game_id ? "View Game →" : "Read More →";

  return (
    <Link className="news-card" href={href}>
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
}

// Week filter lives in the URL (?week=), same convention as /home's
// own ?season=&week= -- a plain server-rendered filter, not client
// state, so a direct link to e.g. /stories?week=2 is shareable and
// works without JS. "All" (no week param) shows everything -- fine at
// today's ~34 entries, but the per-week view is what keeps this page
// usable once a full season (18 weeks x 16 games = 288+) is published;
// finding one specific game in a flat list at that size isn't
// realistic, per the 2026-09-23 ask that added this filter.
export default async function StoriesArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const params = await searchParams;

  const [gameStories, performanceReviews] = await Promise.all([
    getPublishedStories(ARCHIVE_LIMIT),
    getPublishedPerformanceReviews(ARCHIVE_LIMIT),
  ]);

  const allEntries = [...gameStories, ...performanceReviews].sort((a, b) => {
    const aTime = a.published_at ? new Date(a.published_at).getTime() : 0;
    const bTime = b.published_at ? new Date(b.published_at).getTime() : 0;
    return bTime - aTime;
  });

  const availableWeeks = [...new Set(allEntries.map((s) => s.week))].sort((a, b) => a - b);
  // A week with zero stories yet (this week's games haven't finished)
  // is a real, meaningful filter -- not the same as a garbage value
  // (?week=abc, ?week=999). The former should show "no recaps for
  // Week 3 yet"; only the latter falls back to "All". Regular season
  // is 18 weeks, but this stays a little generous for postseason.
  const requestedWeek = params.week ? Number(params.week) : NaN;
  const activeWeek = Number.isInteger(requestedWeek) && requestedWeek >= 1 && requestedWeek <= 22 ? requestedWeek : null;

  const entries = activeWeek === null ? allEntries : allEntries.filter((s) => s.week === activeWeek);

  return (
    <>
      <header className="site-header">
        <h1 className="glow">GAME RECAPS &amp; ANALYSIS</h1>
        <p className="subtitle">{"// every recap and model performance review we've published"}</p>
      </header>

      {availableWeeks.length > 1 && (
        <nav className="week-rail" aria-label="Week selector">
          <Link href="/stories" className={`week-pill ${activeWeek === null ? "active" : ""}`}>
            All Weeks
          </Link>
          {availableWeeks.map((w) => (
            <Link key={w} href={`/stories?week=${w}`} className={`week-pill ${w === activeWeek ? "active" : ""}`}>
              WK {w}
            </Link>
          ))}
        </nav>
      )}

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
              {activeWeek === null
                ? "No recaps published yet -- check back once this week's games are final."
                : `No recaps for Week ${activeWeek}.`}
            </p>
          ) : (
            <>
              <div className="news-grid">
                {entries.map((story) => (
                  <StoryCard key={story.id} story={story} />
                ))}
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
