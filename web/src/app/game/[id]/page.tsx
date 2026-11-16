import Link from "next/link";
import { getGameDetail, getGameDetailBase, formatKickoff } from "@/lib/predictions";
import { getScheduledGame } from "@/lib/schedule";
import { getStoryForGame } from "@/lib/stories";
import { teamByAlias, teamLogoPath } from "@/lib/teams";
import { createClient } from "@/lib/supabase/server";
import { getUserEnabledBooks, booksExcludedByUserPref } from "@/lib/sportsbookPrefs";
import { getUserPropEdits } from "@/lib/propEdits";
import { getUserOddsFormat } from "@/lib/oddsFormatPrefs";
import GameDetailView from "./GameDetailView";
import { SITE_URL, organizationRef, ORGANIZATION_NAME, TWITTER_SITE } from "@/lib/seo";

function teamDisplay(alias: string): string {
  const team = teamByAlias(alias);
  return team ? `${team.market} ${team.name}` : alias;
}

// Per-game title/description (shown in search results, browser tabs,
// and as the fallback text on a share preview) plus an explicit
// "summary_large_image" Twitter card -- without this Twitter falls
// back to its small thumbnail card even though opengraph-image.tsx
// already supplies a full-size image.
//
// No "| Matrix Sports Analytics" suffix here (unlike most other
// pages' titles) -- team names alone can already run to ~45
// characters for the longest matchups, and the suffix would push
// every single one of the hundreds of game pages past the 60-char
// mark search engines truncate at. Brand still comes through via
// openGraph.siteName (set once in the root layout).
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // The base load only (no betting edge) -- shared with the page body's
  // own getGameDetail call through React's cache(), so the title costs
  // no extra database work. See getGameDetailBase's comment.
  const game = await getGameDetailBase(id);
  if (!game) return {};

  const a = teamDisplay(game.teamA.alias);
  const b = teamDisplay(game.teamB.alias);
  const description =
    game.status === "final"
      ? `Final: ${a} ${game.teamA.score} — ${b} ${game.teamB.score}. See the model's pregame win probability and how it played out.`
      : `${a} ${game.teamA.winProb}% to win vs ${b} ${game.teamB.winProb}% — from 100,000 simulated games.`;
  const title = `${a} vs ${b} — Win Probability`;
  const url = `${SITE_URL}/game/${id}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website" as const, siteName: ORGANIZATION_NAME, title, description, url },
    twitter: { card: "summary_large_image" as const, site: TWITTER_SITE, title, description },
  };
}

export default async function GameDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ hideBanned?: string }>;
}) {
  const { id } = await params;
  // Default OFF (user, 2026-11-14) -- "My Bookies" now owns this decision
  // per user; only an explicit "1" turns the old site-wide filter back on.
  // See GameDetailView.tsx's BannedBooksToggle for the control that sets
  // this query param.
  const hideBannedBooks = (await searchParams).hideBanned === "1";
  // Anonymous visitors get userId undefined -> getUserEnabledBooks
  // returns [] -> no restriction, same as before this feature existed.
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  // Three independent per-user reads -- run together, not one after another.
  const [enabledBooks, propEdits, oddsFormat] = await Promise.all([
    getUserEnabledBooks(supabase, userData.user?.id),
    getUserPropEdits(supabase, userData.user?.id),
    getUserOddsFormat(supabase, userData.user?.id),
  ]);
  const userExcludedBooks = booksExcludedByUserPref(enabledBooks);
  const game = await getGameDetail(id, hideBannedBooks, userExcludedBooks);
  if (game) {
    const story = game.finalResult ? await getStoryForGame(id) : null;
    const a = teamDisplay(game.teamA.alias);
    const b = teamDisplay(game.teamB.alias);
    const url = `${SITE_URL}/game/${id}`;

    // Every game page describes a real SportsEvent regardless of
    // whether a recap has been written yet -- this is what the "no
    // structured data on this page at all" finding covered: upcoming
    // games had zero JSON-LD since the Article block below only
    // exists once a final-result recap is published.
    const sportsEventJsonLd = {
      "@context": "https://schema.org",
      "@type": "SportsEvent",
      name: `${a} vs ${b}`,
      url,
      sport: "American Football",
      competitor: [
        { "@type": "SportsTeam", name: a },
        { "@type": "SportsTeam", name: b },
      ],
      organizer: organizationRef,
      ...(game.finalResult
        ? { eventStatus: "https://schema.org/EventCompleted" }
        : { eventStatus: "https://schema.org/EventScheduled" }),
    };

    // Recommendations Google lists for Article (image, author.url) plus
    // the citability fields ("Article Citability Signals") an engine
    // uses to tell a page is a source rather than a summary: about,
    // description, inLanguage, articleSection. `citation` is
    // deliberately left out -- this recap has no external sources to
    // list, and fabricating one would be worse than omitting the field.
    const articleJsonLd = story
      ? {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: story.headline,
          description: story.body.slice(0, 200),
          articleBody: story.body,
          articleSection: "Game Recap",
          inLanguage: "en-US",
          about: { "@type": "SportsEvent", name: `${a} vs ${b}` },
          image: `${url}/opengraph-image`,
          datePublished: story.published_at ?? undefined,
          url,
          author: { ...organizationRef, url: SITE_URL },
          publisher: organizationRef,
        }
      : null;
    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(sportsEventJsonLd) }} />
        {articleJsonLd && (
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
        )}
        <GameDetailView game={game} story={story} scope={`game:${id}`} propEdits={propEdits} oddsFormat={oddsFormat} />
      </>
    );
  }

  // No prediction row yet -- fall back to the schedule (kickoff time,
  // and the real score once it's played) rather than a dead end.
  const scheduled = await getScheduledGame(id);
  if (!scheduled) {
    return (
      <main>
        <h1 className="sr-only">Game not found</h1>
        <p style={{ textAlign: "center", color: "var(--text-dim)" }}>
          No prediction found for this game.
        </p>
      </main>
    );
  }

  const scheduledAway = teamDisplay(scheduled.away_team);
  const scheduledHome = teamDisplay(scheduled.home_team);

  return (
    <main>
      <Link href="/home" style={{ display: "inline-block", marginBottom: "1.5rem", color: "var(--text-dim)" }}>
        &larr; back to predictions
      </Link>
      <div className="game-hero">
        <h1 className="sr-only">
          {scheduledAway} vs {scheduledHome}
        </h1>
        <div className="matchup-status" style={{ justifyContent: "center", marginBottom: "1.5rem" }}>
          <span className={`tag ${scheduled.final ? "final" : "preview"}`}>
            {scheduled.final ? "FINAL" : formatKickoff(scheduled.game_date)}
          </span>
        </div>
        <div className="game-hero-teams">
          <div className="game-hero-team">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={teamLogoPath(scheduled.away_team)} alt={`${scheduledAway} logo`} />
            <div className="name">{scheduledAway}</div>
            {scheduled.final && <div className="big-prob">{scheduled.actual_away_score}</div>}
          </div>
          <div className="game-hero-vs">VS</div>
          <div className="game-hero-team">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={teamLogoPath(scheduled.home_team)} alt={`${scheduledHome} logo`} />
            <div className="name">{scheduledHome}</div>
            {scheduled.final && <div className="big-prob">{scheduled.actual_home_score}</div>}
          </div>
        </div>
        <div className="game-hero-meta">
          {scheduled.final
            ? "The model hasn't generated a prediction for this game -- only the real result is shown above."
            : "The model hasn't generated a prediction for this game yet -- check back closer to kickoff."}
        </div>
      </div>
    </main>
  );
}
