import Link from "next/link";
import { notFound } from "next/navigation";
import { getStoryById } from "@/lib/stories";
import { accuracyPctFromStory, performanceTierImagePath } from "@/lib/performanceTier";
import { SITE_URL, organizationRef, metaDescription, ORGANIZATION_NAME, TWITTER_SITE } from "@/lib/seo";

// Standalone article page for a story with no universal_game_id (a
// weekly performance review, not a per-game recap -- see
// stories.ts's getLatestPerformanceReview). Deliberately public, no
// sign-in/member gate, unlike the per-game recap embedded in
// GameDetailView (locked there unless the visitor is a member or it's
// the free premier game) -- this content's whole purpose is to be the
// destination for a social-post link a signed-out visitor clicks, so
// gating it would defeat that purpose. A per-game story still only
// ever shows on its own /game/[id] page, not here.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const story = await getStoryById(id);
  if (!story) return {};

  const accuracyPct = accuracyPctFromStory(story);
  const image = accuracyPct !== null ? performanceTierImagePath(accuracyPct) : undefined;
  // No "| Matrix Sports Analytics" suffix -- headline alone can
  // already run long (this was the one page the scan still flagged
  // at 75 characters after every other title got shortened). Brand
  // still comes through via openGraph.siteName.
  const title = story.headline;
  const description = metaDescription(story.body);
  const url = `${SITE_URL}/stories/${id}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article" as const,
      siteName: ORGANIZATION_NAME,
      title,
      description,
      url,
      images: image ? [{ url: image, width: 1774, height: 887 }] : undefined,
    },
    twitter: { card: "summary_large_image" as const, site: TWITTER_SITE, title, description, images: image ? [image] : undefined },
  };
}

export default async function StoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const story = await getStoryById(id);
  if (!story) notFound();

  const published = story.published_at ? new Date(story.published_at) : null;
  const accuracyPct = accuracyPctFromStory(story);
  const heroImage = accuracyPct !== null ? performanceTierImagePath(accuracyPct) : null;

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: story.headline,
    description: metaDescription(story.body),
    articleBody: story.body,
    articleSection: "Weekly Performance Review",
    inLanguage: "en-US",
    image: heroImage ? `${SITE_URL}${heroImage}` : undefined,
    datePublished: story.published_at ?? undefined,
    url: `${SITE_URL}/stories/${id}`,
    author: { ...organizationRef, url: SITE_URL },
    publisher: organizationRef,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />

      <header className="site-header">
        <h1 className="glow">{story.headline}</h1>
        <p className="subtitle">
          {"// "}
          Season {story.season}, Week {story.week}
          {published ? ` — ${published.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}` : ""}
        </p>
      </header>

      <main className="story-page-main">
        {heroImage && (
          // eslint-disable-next-line @next/next/no-img-element -- a
          // static designer-provided asset, not something next/image
          // needs to optimize per-request.
          <img
            src={heroImage}
            alt=""
            style={{ width: "100%", maxWidth: "100%", borderRadius: "12px", marginBottom: "2rem", display: "block" }}
          />
        )}

        {/* Same .story-recap/.story-recap-body pair GameRecap uses on
            /game/[id] -- same dark card, same gold body copy -- kept
            deliberately identical rather than this page inventing its
            own look. */}
        <div className="story-recap">
          {story.body.split("\n").map((paragraph, i) => (
            <p key={i} className="story-recap-body" style={{ marginTop: i === 0 ? 0 : "1rem" }}>
              {paragraph}
            </p>
          ))}
        </div>

        <p style={{ textAlign: "center", marginTop: "2rem" }}>
          <Link className="btn btn-primary" href="/home">
            See This Week&apos;s Full Slate →
          </Link>
        </p>
      </main>

      <footer className="site-footer">
        <p>
          Every number above comes straight from real, final game results and the model&apos;s own
          pregame predictions -- nothing here is guessed or invented. See{" "}
          <Link href="/home">the predictions page</Link> for this week&apos;s full slate.
        </p>
      </footer>
    </>
  );
}
