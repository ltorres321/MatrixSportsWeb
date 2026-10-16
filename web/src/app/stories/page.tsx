import Link from "next/link";
import { getPublishedStoriesPage, getPublishedStoryWeeks } from "@/lib/stories";
import AdFrame from "@/components/AdFrame";
import MobileAdFrame from "@/components/MobileAdFrame";
import AdUnit from "@/components/AdUnit";
import { pageMetadata } from "@/lib/seo";
import StoriesInfiniteList from "./StoriesInfiniteList";

export const metadata = pageMetadata({
  title: "Game Recaps & Analysis — Matrix Sports Analytics",
  description:
    "Every NFL game recap and weekly model performance review published on Matrix Sports Analytics, newest first.",
  path: "/stories",
});

// Server-rendered first page only (fast first paint, works without JS,
// real content for crawlers) -- everything after this comes from
// StoriesInfiniteList's client-side scroll-triggered fetches against
// /api/stories. Was ARCHIVE_LIMIT=500-fetched-and-rendered-at-once
// until 2026-10-16: every card's image is a dynamically-rendered route
// (opengraph-image.tsx), and the list was only going to keep growing
// (288+ games by season's end) -- rendering all of it on every visit,
// every time, doesn't scale the way a first-page-plus-infinite-scroll
// does.
const PAGE_SIZE = 18;

// Week filter lives in the URL (?week=), same convention as /home's
// own ?season=&week= -- a plain server-rendered filter, not client
// state, so a direct link to e.g. /stories?week=2 is shareable and
// works without JS.
export default async function StoriesArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const params = await searchParams;

  const availableWeeks = await getPublishedStoryWeeks();
  // A week with zero stories yet (this week's games haven't finished)
  // is a real, meaningful filter -- not the same as a garbage value
  // (?week=abc, ?week=999). The former should show "no recaps for
  // Week 3 yet"; only the latter falls back to "All". Regular season
  // is 18 weeks, but this stays a little generous for postseason.
  const requestedWeek = params.week ? Number(params.week) : NaN;
  const activeWeek = Number.isInteger(requestedWeek) && requestedWeek >= 1 && requestedWeek <= 22 ? requestedWeek : null;

  const { stories: entries, hasMore } = await getPublishedStoriesPage({
    week: activeWeek ?? undefined,
    offset: 0,
    limit: PAGE_SIZE,
  });

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
              {/* h2, not visible -- the h3 card headlines below had
                  nothing between them and the page's h1, skipping a
                  level. */}
              <h2 className="sr-only">{activeWeek === null ? "All Recaps" : `Week ${activeWeek} Recaps`}</h2>
              {/* key forces a fresh component instance per week filter --
                  simpler and more robust than relying on the internal
                  reset effect alone when the week param changes via a
                  plain Link navigation. */}
              <StoriesInfiniteList
                key={activeWeek ?? "all"}
                initialStories={entries}
                initialHasMore={hasMore}
                week={activeWeek}
              />

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
