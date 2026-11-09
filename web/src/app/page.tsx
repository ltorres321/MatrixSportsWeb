import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  getAvailableSeasons,
  getDefaultWeek,
  getPremierGame,
  getMatchupsForSeasonWeek,
  getCurrentSeasonYear,
  getWeeksForSeason,
  getConfidenceRecord,
  type ConfidenceRecord,
} from "@/lib/predictions";
import type { Matchup } from "@/lib/matchups";
import MatchupCard from "@/components/MatchupCard";
import {
  getAvailableNbaSeasons,
  getDefaultNbaDate,
  getMatchupsForNbaDate,
  getAvailableNbaDates,
  getNbaConfidenceRecord,
} from "@/lib/nbaPredictions";
import NbaMatchupCard from "@/components/NbaMatchupCard";
import { NBA_TEAMS } from "@/lib/teamsNba";
import AdFrame from "@/components/AdFrame";
import MobileAdFrame from "@/components/MobileAdFrame";
import AdUnit from "@/components/AdUnit";
import { getPublishedStories } from "@/lib/stories";
import { pageMetadata } from "@/lib/seo";
import { ParlayCard } from "@/components/ParlayCard";
import { NbaParlayCard } from "@/components/NbaParlayCard";
import { buildWeekParlays } from "@/app/parlays/page";
import { loadNbaWeekParlays } from "@/app/parlays/nba/page";
import { getCurrentNbaWeek, etDateKey } from "@/lib/nbaSchedule";
import { formatDate } from "@/app/parlays/nba/NbaParlaysView";

// The only page a signed-out visitor or crawler (including Google's
// AdSense reviewer, which never logs in) ever lands on -- see the
// comment on recentStories below. Previously had no metadata of its
// own and silently inherited the generic layout-wide title/description,
// which undersold the actual free-picks pitch on the one page search
// engines can actually see.
//
// Title kept under 60 characters (the Free NFL Win Probabilities --
// 100,000 Simulations Per Game | Matrix Sports Analytics version
// this replaced ran 83 and was getting truncated mid-phrase in results).
export const metadata: Metadata = pageMetadata({
  title: "Free NFL Win Probabilities — Matrix Sports Analytics",
  description:
    "Matrix Sports Analytics simulates every NFL matchup 100,000 times, grounded in the real betting line. See this week's free model picks and game recaps.",
  path: "/",
});

// Home-page article cards are teasers, not the full recap -- the
// 250-300 word body belongs on the game's own page (linked via "View
// Game"). Cuts at the last whole word inside the limit rather than
// mid-word, since this is a recap paragraph, not a hand-written blurb.
function truncateTeaser(text: string, maxChars = 160): string {
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : maxChars)}…`;
}

// Empty-state card for the "My Favorites" row's NFL or NBA slot when
// the signed-in user hasn't picked a favorite team for that league yet
// (My Profile -- favorite_team / favorite_nba_team). Sized/centered to
// sit in the same matchup-grid column a real MatchupCard/NbaMatchupCard
// would occupy.
function AddFavoriteCard({ league }: { league: "NFL" | "NBA" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
      <div className="unlock-card">
        <span className="lock-icon">⭐</span>
        <h3>Pick a Favorite {league} Team</h3>
        <p>Choose a favorite {league} team on My Profile and we&apos;ll surface their game right here.</p>
        <Link className="btn btn-primary btn-block" href="/profile#address-team">
          Add Favorite Team
        </Link>
      </div>
    </div>
  );
}

// A favorite IS set, there's just no game to show for it right now --
// an NFL bye week, or (NBA, which this page only ever looks at TODAY's
// slate for -- see getNbaDayMatchups) a team simply not playing today.
// Different from AddFavoriteCard's copy on purpose: that one invites
// picking a team; this one would be lying if it said the same thing
// to someone who already has.
function NoFavoriteGameCard({ league, note }: { league: "NFL" | "NBA"; note: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
      <div className="unlock-card">
        <span className="lock-icon">⭐</span>
        <h3>No {league} Game Today</h3>
        <p>{note}</p>
        <Link className="btn btn-ghost btn-block" href="/profile#address-team">
          Change Favorite Team
        </Link>
      </div>
    </div>
  );
}

// No premier/featured-game concept exists for NBA yet (see
// nbaPredictions.ts's module header), so this just takes the first
// game of the default slate's date -- same "today, or the next date
// with games" rule home/nba/page.tsx already uses. Shown on the home
// page unconditionally, same as the NFL premier game: NBA has no
// member-preview paywall at all yet (see NbaPredictionsView.tsx), so
// there's no "locked" counterpart for this card to be a free preview
// of.
// Full day's slate, not just the featured game -- SignedInDashboard's
// "My Favorites" row needs to search this for the user's favorite NBA
// team's own game, not only whichever game happens to be featured.
async function getNbaDayMatchups(): Promise<Matchup[]> {
  const nbaSeasons = await getAvailableNbaSeasons();
  const nbaSeason = nbaSeasons[0];
  if (nbaSeason === undefined) return [];
  const nbaDate = await getDefaultNbaDate(nbaSeason);
  if (!nbaDate) return [];
  return getMatchupsForNbaDate(nbaSeason, nbaDate);
}

async function getFeaturedNbaGame(): Promise<Matchup | undefined> {
  const nbaMatchups = await getNbaDayMatchups();
  return nbaMatchups[0];
}

// "My Favorites" row fallbacks: the favorite team isn't playing in the
// current window (NFL: this week; NBA: today), so look ahead instead
// of just saying there's no game -- a bye week or an off night isn't
// the same as not having picked a team (user, 2026-11-09: "please
// place there next game"). Both walk forward one window at a time and
// stop at the first match, so the common case (team plays again
// within a few days/weeks) costs only a couple of extra queries, not
// a scan of the whole season.
async function getNextNflGameForTeam(
  season: number,
  afterWeek: number,
  alias: string
): Promise<{ matchup: Matchup; week: number } | undefined> {
  const weeks = (await getWeeksForSeason(season)).filter((w) => w > afterWeek).sort((a, b) => a - b);
  for (const week of weeks) {
    const matchups = await getMatchupsForSeasonWeek(season, week, null);
    const found = matchups.find((m) => m.teamA.alias === alias || m.teamB.alias === alias);
    if (found) return { matchup: found, week };
  }
  return undefined;
}

// Capped at the next 14 available predicted dates -- getAvailableNbaDates
// only returns dates latest_nba_predictions actually has rows for
// (typically a near-term rolling window, not the whole season), so this
// is already a short list in practice; the cap just keeps a team with no
// more predicted games left from turning into an unbounded scan.
//
// `displayName` not `alias` -- NBA's own TeamSide.alias (unlike NFL's)
// holds the full "{market} {name}" display string, not a short code
// (see nbaPredictions.ts's getMatchupsForNbaDate and NbaMatchupCard.tsx's
// own comment on this). nbaTeamDisplayName() below converts a
// profiles.favorite_nba_team alias code to that same string before
// anything here compares against it.
async function getNextNbaGameForTeam(
  nbaSeason: number,
  afterDateKey: string,
  displayName: string
): Promise<Matchup | undefined> {
  const dates = (await getAvailableNbaDates(nbaSeason))
    .filter((d) => d > afterDateKey)
    .sort()
    .slice(0, 14);
  for (const date of dates) {
    const matchups = await getMatchupsForNbaDate(nbaSeason, date);
    const found = matchups.find((m) => m.teamA.alias === displayName || m.teamB.alias === displayName);
    if (found) return found;
  }
  return undefined;
}

// profiles.favorite_nba_team stores the short alias code (same as the
// <select> on My Profile) -- see getNextNbaGameForTeam's own comment on
// why every NBA matchup comparison here needs the full display string
// instead.
function nbaTeamDisplayName(alias: string): string | undefined {
  const team = NBA_TEAMS.find((t) => t.alias === alias);
  return team ? `${team.market} ${team.name}` : undefined;
}

// "22-7 (75.9%)" -- confidence-record tiles (user, 2026-11-09: "also
// after the record ##-# (##%)").
function formatConfidenceRecord(record: ConfidenceRecord): string {
  const total = record.wins + record.losses;
  const pct = total > 0 ? (record.wins / total) * 100 : 0;
  return `${record.wins}-${record.losses} (${pct.toFixed(1)}%)`;
}

// Three-line layout (user, 2026-11-09: the flat "22-7 (75.9%)" +
// "at 70%+ confidence" pairing read as two disconnected facts --
// spelling out "Record for NFL games / when model predicts 70%+"
// above the record itself makes each tile readable on its own).
function ConfidenceTile({
  league,
  thresholdPct,
  record,
  href,
}: {
  league: "NFL" | "NBA";
  thresholdPct: 70 | 80;
  record: ConfidenceRecord;
  // Links through to the actual games behind this record (user,
  // 2026-11-09). NFL only for now -- omitted for NBA until its own
  // games-list page exists, so those tiles stay plain for the moment
  // rather than linking somewhere that doesn't exist yet.
  href?: string;
}) {
  const body = (
    <>
      <span className="confidence-tile-label">Record for {league} games</span>
      <span className="confidence-tile-label">when model predicts {thresholdPct}%+</span>
      <span className="confidence-tile-record">{formatConfidenceRecord(record)}</span>
    </>
  );
  if (href) {
    return (
      <Link className="confidence-tile confidence-tile-link" href={href}>
        {body}
      </Link>
    );
  }
  return <div className="confidence-tile">{body}</div>;
}

// Signed-out visitors get the marketing pitch below. Signed-in users
// get a real dashboard instead -- see SignedInDashboard.
export default async function HomePage({
  searchParams,
}: {
  // SANDBOX ONLY (branch sandbox/home-parlays): ?preview=1 forces the
  // signed-in dashboard view without a real login, purely so this
  // layout can be screenshotted/reviewed. previewFavNfl/previewFavNba
  // let that same preview simulate a populated "My Favorites" row
  // (team alias, e.g. ?previewFavNfl=MIA&previewFavNba=MIA) without
  // writing anything to a real profile. None of this is meant to
  // reach main.
  searchParams: Promise<{ preview?: string; previewFavNfl?: string; previewFavNba?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (data.user || params.preview === "1") {
    const firstName = (data.user?.user_metadata?.first_name as string | undefined) ?? "Leo";
    return (
      <SignedInDashboard
        firstName={firstName}
        userId={data.user?.id}
        previewFavNfl={params.previewFavNfl}
        previewFavNba={params.previewFavNba}
      />
    );
  }

  const seasons = await getAvailableSeasons();
  const fallbackSeason = await getCurrentSeasonYear();
  const season = seasons.includes(fallbackSeason) ? fallbackSeason : seasons[0];

  let premier: Matchup | undefined;
  let currentWeek: number | null = null;
  if (season !== undefined) {
    currentWeek = await getDefaultWeek(season);
    if (currentWeek !== null) {
      const premierGame = await getPremierGame(season, currentWeek);
      const matchups = await getMatchupsForSeasonWeek(season, currentWeek, premierGame);
      premier = matchups.find((m) => m.premier);
    }
  }

  const featuredNbaGame = await getFeaturedNbaGame();

  // Signed-out visitors previously had zero links to any of the
  // site's actual written content (every recap lived one login away,
  // behind SignedInDashboard) -- this is the one page an anonymous
  // crawler (including Google's own AdSense reviewer) ever sees, so a
  // real sample of it has to be reachable from here directly.
  const recentStories = await getPublishedStories(3);

  return (
    <>
      {/* Signed-out visitors -- including Google's own AdSense crawler,
          which never logs in -- only ever see this branch, never
          SignedInDashboard below. Ad placements have to live here too,
          not just there, or the site's actual entry page has none. */}
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
          <section className="hero">
            <div className="hero-eyebrow">
              <span className="dot"></span> FREE DURING BETA
            </div>
            <h1 className="hero-title">
              SEE THE GAME
              <br />
              <span>BEFORE IT&apos;S PLAYED</span>
            </h1>
            <p className="hero-sub">
              Matrix Sports Analytics simulates every NFL matchup 100,000 times,
              grounded in the real betting line — not a boosted number. Free
              model picks for early users, every week.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary btn-gold" href="/home">
                View All Picks For This Week
              </Link>
              <Link className="btn btn-primary" href="/signup">
                Get Early Access — Free
              </Link>
            </div>
            <p className="hero-note">No credit card required.</p>
          </section>

          {premier && (
            <div className="premier-wrap">
              <div className={`premier-ribbon ${premier.lockOfWeek ? "gold" : ""}`}>
                {premier.lockOfWeek ? "🔒 LOCK OF THE WEEK" : `★ ${premier.premierLabel ?? "GAME OF THE WEEK"} — FREE PREVIEW`}
              </div>
              <MatchupCard matchup={premier} premier />
              <div style={{ textAlign: "center", marginTop: "1.25rem" }}>
                <Link className="btn btn-primary" href="/signup">
                  View Full Week {currentWeek} Slate →
                </Link>
              </div>
            </div>
          )}

          {featuredNbaGame && (
            <div className="premier-wrap">
              <div className="premier-ribbon">🏀 FEATURED NBA GAME</div>
              <NbaMatchupCard matchup={featuredNbaGame} premier />
              <div style={{ textAlign: "center", marginTop: "1.25rem" }}>
                <Link className="btn btn-primary" href="/signup">
                  View Full NBA Slate →
                </Link>
              </div>
            </div>
          )}

          <div className="mobile-ad-wrap" aria-label="Promotional space">
            <MobileAdFrame>
              <AdUnit kind="mobile" />
              <span className="slot-label">Ad space</span>
            </MobileAdFrame>
          </div>

          {/* h2, not visible as its own element -- the h3 feature
              cards below had nothing between them and the page's h1,
              skipping a level. The grid itself makes "why sign up"
              obvious visually, so this just gives crawlers/screen
              readers the same structure without adding visible text. */}
          <h2 className="sr-only">Why Matrix Sports Analytics</h2>
          <div className="value-grid">
            <div className="value-card">
              <span className="icon">🎯</span>
              <h3>Model-Driven Probabilities</h3>
              <p>Every matchup gets a simulated win probability, refreshed as the market line moves.</p>
            </div>
            <div className="value-card">
              <span className="icon">🔓</span>
              <h3>One Free Game a Week</h3>
              <p>Anyone can view our marquee Game of the Week. Sign up free to see the full slate.</p>
            </div>
            <div className="value-card">
              <span className="icon">🏷️</span>
              <h3>Early Subscriber Pricing</h3>
              <p>Free accounts created now lock in preferential pricing when paid tiers launch later.</p>
            </div>
          </div>

          {recentStories.length > 0 && (
            <div className="news-section">
              <h2 className="section-label">
                <span className="dot" /> LATEST GAME RECAPS
              </h2>
              <div className="news-grid">
                {recentStories.map((story) => (
                  <Link key={story.id} className="news-card" href={`/game/${story.universal_game_id}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- generated route, not a static asset next/image can optimize */}
                    <img
                      className="news-card-image"
                      src={`/game/${story.universal_game_id}/thumbnail-image`}
                      alt=""
                    />
                    <div className="news-card-body">
                      <h3>{story.headline}</h3>
                      <p>{truncateTeaser(story.body)}</p>
                      <span className="read-more">View Game →</span>
                    </div>
                  </Link>
                ))}
              </div>
              <div style={{ textAlign: "center", marginTop: "1.25rem" }}>
                <Link className="btn btn-primary" href="/stories">
                  Browse All Recaps →
                </Link>
              </div>
            </div>
          )}

          <div className="mobile-ad-wrap" aria-label="Promotional space">
            <MobileAdFrame>
              <AdUnit kind="mobile" />
              <span className="slot-label">Ad space</span>
            </MobileAdFrame>
          </div>

          <div className="pricing-strip">
            <span>
              🔒 Early subscribers get <strong>preferential pricing</strong> — sign up free
              during beta to lock in your rate before paid tiers launch.
            </span>
            <Link className="btn btn-primary btn-gold" href="/signup">
              Claim Your Spot
            </Link>
          </div>

          <div className="mobile-ad-wrap" aria-label="Promotional space">
            <MobileAdFrame>
              <AdUnit kind="mobile" />
              <span className="slot-label">Ad space</span>
            </MobileAdFrame>
          </div>
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

      <footer className="site-footer">
        <p>
          Simulated pre-game probabilities, updated as the market line moves. See{" "}
          <Link href="/home">the predictions page</Link> for this week&apos;s full
          slate.
        </p>
      </footer>
    </>
  );
}

async function SignedInDashboard({
  firstName,
  userId,
  previewFavNfl,
  previewFavNba,
}: {
  firstName?: string;
  userId?: string;
  // SANDBOX ONLY -- see HomePage's own comment on these two.
  previewFavNfl?: string;
  previewFavNba?: string;
}) {
  const seasons = await getAvailableSeasons();
  const fallbackSeason = await getCurrentSeasonYear();
  const season = seasons.includes(fallbackSeason) ? fallbackSeason : seasons[0];

  let premier: Matchup | undefined;
  let currentWeek: number | null = null;
  let nflMatchups: Matchup[] = [];
  if (season !== undefined) {
    currentWeek = await getDefaultWeek(season);
    if (currentWeek !== null) {
      const premierGame = await getPremierGame(season, currentWeek);
      nflMatchups = await getMatchupsForSeasonWeek(season, currentWeek, premierGame);
      premier = nflMatchups.find((m) => m.premier);
    }
  }

  // NFL model-confidence record tiles under "View Full Week N Slate"
  // (user, 2026-11-09: "Showing 22-7 records for model when model
  // predicts 70%+ and 5-1 when 80%+") -- this season only, computed
  // live rather than hardcoded so it stays correct as more games grade.
  let confidenceRecord70: ConfidenceRecord | null = null;
  let confidenceRecord80: ConfidenceRecord | null = null;
  if (season !== undefined) {
    confidenceRecord70 = await getConfidenceRecord(season, 0.7);
    confidenceRecord80 = await getConfidenceRecord(season, 0.8);
  }

  const nbaDayMatchups = await getNbaDayMatchups();
  const featuredNbaGame = nbaDayMatchups[0];

  // Same tiles, NBA side (user, 2026-11-09: "lets do these under the
  // basketball premier game also"). getNbaConfidenceRecord is cached
  // (nbaPredictions.ts's own comment on why) since, unlike NFL's,
  // building this walks every date in the season through real external
  // API-backed grading, not a single cheap SQL aggregate.
  let nbaConfidenceRecord70: ConfidenceRecord | null = null;
  let nbaConfidenceRecord80: ConfidenceRecord | null = null;
  const nbaSeasonsForRecord = await getAvailableNbaSeasons();
  const nbaSeasonForRecord = nbaSeasonsForRecord[0];
  if (nbaSeasonForRecord !== undefined) {
    nbaConfidenceRecord70 = await getNbaConfidenceRecord(nbaSeasonForRecord, 0.7);
    nbaConfidenceRecord80 = await getNbaConfidenceRecord(nbaSeasonForRecord, 0.8);
  }

  // "My Favorites" row: one favorite NFL team + one favorite NBA team,
  // each picked on My Profile (profiles.favorite_team/favorite_nba_team
  // -- sql/015_favorite_nba_team.sql). A signed-out preview (see
  // HomePage) has no real profile row to read, so it falls back to the
  // previewFavNfl/previewFavNba query params instead.
  let favoriteNflAlias: string | null = previewFavNfl ?? null;
  let favoriteNbaAlias: string | null = previewFavNba ?? null;
  if (userId) {
    const supabase = await createClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("favorite_team, favorite_nba_team")
      .eq("id", userId)
      .single();
    favoriteNflAlias = profile?.favorite_team ?? null;
    favoriteNbaAlias = profile?.favorite_nba_team ?? null;
  }
  let favoriteNflGame = favoriteNflAlias
    ? nflMatchups.find((m) => m.teamA.alias === favoriteNflAlias || m.teamB.alias === favoriteNflAlias)
    : undefined;
  let favoriteNflGameWeek = currentWeek;
  let favoriteNflIsNextGame = false;
  if (favoriteNflAlias && !favoriteNflGame && currentWeek !== null && season !== undefined) {
    const next = await getNextNflGameForTeam(season, currentWeek, favoriteNflAlias);
    if (next) {
      favoriteNflGame = next.matchup;
      favoriteNflGameWeek = next.week;
      favoriteNflIsNextGame = true;
    }
  }

  const favoriteNbaDisplayName = favoriteNbaAlias ? nbaTeamDisplayName(favoriteNbaAlias) : undefined;
  let favoriteNbaGame = favoriteNbaDisplayName
    ? nbaDayMatchups.find((m) => m.teamA.alias === favoriteNbaDisplayName || m.teamB.alias === favoriteNbaDisplayName)
    : undefined;
  let favoriteNbaIsNextGame = false;
  if (favoriteNbaDisplayName && !favoriteNbaGame) {
    const nbaSeasons = await getAvailableNbaSeasons();
    const nbaSeason = nbaSeasons[0];
    if (nbaSeason !== undefined) {
      const next = await getNextNbaGameForTeam(nbaSeason, etDateKey(new Date()), favoriteNbaDisplayName);
      if (next) {
        favoriteNbaGame = next;
        favoriteNbaIsNextGame = true;
      }
    }
  }
  const hasNoFavorites = !favoriteNflAlias && !favoriteNbaAlias;

  // SANDBOX (home layout preview, branch sandbox/home-parlays): the
  // ESPN/site-recap "LATEST NFL COVERAGE" grid that used to live here
  // is swapped out for a "Parlays to Play" section instead, reusing the
  // same cached, Postgres-backed builders the /parlays and /parlays/nba
  // pages already use -- no ESPN links on this dashboard for now.
  const nflWeekParlays =
    season !== undefined && currentWeek !== null ? await buildWeekParlays(season, currentWeek, true) : null;

  const nbaWeek = getCurrentNbaWeek();
  const { days: nbaDays } = await loadNbaWeekParlays(nbaWeek.weekStart, nbaWeek.weekEndExclusive, true, false);
  const todayKey = etDateKey(new Date());
  const nbaDayParlays = nbaDays.find((d) => d.dayKey === todayKey) ?? nbaDays[0] ?? null;

  return (
    <>
      <header className="site-header">
        <h1 className="glow">WELCOME BACK{firstName ? `, ${firstName.toUpperCase()}` : ""}</h1>
        <p className="subtitle">{"// your weekly rundown, model insights, and this week's free pick"}</p>
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
          {(premier || featuredNbaGame) && (
            <div className="premier-wrap">
              <div className={`premier-ribbon ${premier?.lockOfWeek ? "gold" : ""}`}>
                {premier?.lockOfWeek
                  ? "🔒 LOCK OF THE WEEK"
                  : `★ ${premier?.premierLabel ?? "GAME OF THE WEEK"} — FREE PREVIEW`}
              </div>
              <div className="matchup-grid">
                {premier && (
                  // alignSelf: start -- without it, .matchup-grid's default
                  // grid stretch makes this div (now the grid item, unlike
                  // a bare MatchupCard elsewhere) match the taller column's
                  // row height, which then stretches the inner
                  // height:100% MatchupCard too and pushes this column's
                  // own "View Full Slate" link below where the row
                  // visually ends -- crowding straight into the My
                  // Favorites ribbon underneath it (user, 2026-11-09).
                  <div style={{ alignSelf: "start" }}>
                    <MatchupCard matchup={premier} premier />
                    <div style={{ textAlign: "center", marginTop: "1.25rem" }}>
                      <Link className="btn btn-ghost view-slate-btn" href="/home">
                        View Full Week {currentWeek} Slate →
                      </Link>
                    </div>
                    {(confidenceRecord70 || confidenceRecord80) && (
                      <div className="confidence-tile-row">
                        {confidenceRecord70 && (
                          <ConfidenceTile
                            league="NFL"
                            thresholdPct={70}
                            record={confidenceRecord70}
                            href="/home/confidence-record?min=70"
                          />
                        )}
                        {confidenceRecord80 && (
                          <ConfidenceTile
                            league="NFL"
                            thresholdPct={80}
                            record={confidenceRecord80}
                            href="/home/confidence-record?min=80"
                          />
                        )}
                      </div>
                    )}
                  </div>
                )}
                {featuredNbaGame && (
                  <div style={{ alignSelf: "start" }}>
                    <NbaMatchupCard matchup={featuredNbaGame} premier />
                    <div style={{ textAlign: "center", marginTop: "1.25rem" }}>
                      <Link className="btn btn-ghost view-slate-btn" href="/home/nba">
                        View Full NBA Slate →
                      </Link>
                    </div>
                    {(nbaConfidenceRecord70 || nbaConfidenceRecord80) && (
                      <div className="confidence-tile-row">
                        {nbaConfidenceRecord70 && (
                          <ConfidenceTile
                            league="NBA"
                            thresholdPct={70}
                            record={nbaConfidenceRecord70}
                            href="/home/nba/confidence-record?min=70"
                          />
                        )}
                        {nbaConfidenceRecord80 && (
                          <ConfidenceTile
                            league="NBA"
                            thresholdPct={80}
                            record={nbaConfidenceRecord80}
                            href="/home/nba/confidence-record?min=80"
                          />
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="premier-wrap" style={{ marginTop: "2rem" }}>
            <div className="premier-ribbon">♥ MY FAVORITES</div>
            {/* Neither favorite is set -- a pair of empty AddFavoriteCard
                squares here was dead weight with nothing to show yet, so
                this collapses to a single slim pill instead (user,
                2026-11-09: "remove the squares to regain that space").
                Once either favorite is picked, the grid below takes over. */}
            {hasNoFavorites && (
              <div style={{ textAlign: "center" }}>
                <Link className="favorites-empty-pill" href="/profile#address-team">
                  ⭐ Add My Favorite Teams
                </Link>
              </div>
            )}
            {!hasNoFavorites && (
              <div className="matchup-grid">
                {!favoriteNflAlias ? (
                  <AddFavoriteCard league="NFL" />
                ) : favoriteNflGame ? (
                  <div>
                    {/* Always reserved, just hidden when not applicable --
                        otherwise this column's card starts higher than the
                        other column's whenever only one side has a tag,
                        and the two favorite cards no longer line up
                        (user, 2026-11-09). */}
                    <div className="favorite-next-game-tag" style={{ visibility: favoriteNflIsNextGame ? "visible" : "hidden" }}>
                      NEXT GAME — WEEK {favoriteNflGameWeek}
                    </div>
                    <MatchupCard matchup={favoriteNflGame} />
                  </div>
                ) : (
                  <NoFavoriteGameCard league="NFL" note="Your favorite team has no games left scheduled right now." />
                )}
                {!favoriteNbaAlias ? (
                  <AddFavoriteCard league="NBA" />
                ) : favoriteNbaGame ? (
                  <div>
                    <div className="favorite-next-game-tag" style={{ visibility: favoriteNbaIsNextGame ? "visible" : "hidden" }}>
                      NEXT GAME
                    </div>
                    <NbaMatchupCard matchup={favoriteNbaGame} />
                  </div>
                ) : (
                  <NoFavoriteGameCard league="NBA" note="Your favorite team has no games left scheduled right now." />
                )}
              </div>
            )}
          </div>

          <div className="mobile-ad-wrap" aria-label="Promotional space">
            <MobileAdFrame>
              <AdUnit kind="mobile" />
              <span className="slot-label">Ad space</span>
            </MobileAdFrame>
          </div>

          {(nflWeekParlays || nbaDayParlays) && (
            <div className="news-section">
              <h2 className="section-label">
                <span className="dot" /> PARLAYS TO PLAY
              </h2>

              {nflWeekParlays && nflWeekParlays.parlays.single.twoLeg.length > 0 && (
                <div className="stat-section">
                  <h3>Week {currentWeek} Parlays</h3>
                  <p className="stat-sub parlay-week-subtitle">
                    This week&apos;s games haven&apos;t been played yet -- these are the model&apos;s current best
                    picks, not graded results.
                  </p>
                  <div className="parlay-grid parlay-grid-current">
                    {nflWeekParlays.parlays.single.twoLeg.map((parlay, i) => (
                      <ParlayCard key={`nfl-2-${i}`} title={`2-Leg Parlay ${i + 1}`} parlay={parlay} showMatchup />
                    ))}
                    {nflWeekParlays.parlays.single.threeLeg.map((parlay, i) => (
                      <ParlayCard key={`nfl-3-${i}`} title={`3-Leg Parlay ${i + 1}`} parlay={parlay} showMatchup />
                    ))}
                  </div>
                  <div style={{ textAlign: "center", marginTop: "1.25rem" }}>
                    <Link className="btn btn-ghost" href="/parlays">
                      View All NFL Parlays →
                    </Link>
                  </div>
                </div>
              )}

              {nbaDayParlays && nbaDayParlays.parlays.twoLeg.length > 0 && (
                <div className="stat-section">
                  <h3>{formatDate(nbaDayParlays.dayKey, true)} NBA Parlays</h3>
                  <p className="stat-sub parlay-week-subtitle">
                    The model&apos;s current best NBA picks for today&apos;s slate, not graded results.
                  </p>
                  <div className="parlay-grid parlay-grid-current">
                    {nbaDayParlays.parlays.twoLeg.map((parlay, i) => (
                      <NbaParlayCard key={`nba-2-${i}`} title={`2-Leg Parlay ${i + 1}`} parlay={parlay} showMatchup />
                    ))}
                    {nbaDayParlays.parlays.threeLeg.map((parlay, i) => (
                      <NbaParlayCard key={`nba-3-${i}`} title={`3-Leg Parlay ${i + 1}`} parlay={parlay} showMatchup />
                    ))}
                  </div>
                  <div style={{ textAlign: "center", marginTop: "1.25rem" }}>
                    <Link className="btn btn-ghost" href="/parlays/nba">
                      View All NBA Parlays →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mobile-ad-wrap" aria-label="Promotional space">
            <MobileAdFrame>
              <AdUnit kind="mobile" />
              <span className="slot-label">Ad space</span>
            </MobileAdFrame>
          </div>

          <h2 className="section-label">
            <span className="dot" /> INSIGHTS &amp; ARTICLES
          </h2>

          <div className="article-grid">
            <Link className="article-card" href="/about">
              <div className="thumb">🧠</div>
              <h3>How We Turned a Betting Line Into 100,000 Simulated Games</h3>
              <p>
                The full story behind the model: why we start from the market
                line, what we tested and cut, and why 100,000 runs beats a
                single guess.
              </p>
              <span className="read-more">Read More →</span>
            </Link>

            <Link className="article-card" href="/stories">
              <div className="thumb">📰</div>
              <h3>Every Game Recap We&apos;ve Published</h3>
              <p>
                A real, written recap for every final game this season, plus
                our weekly model performance reviews -- not just the handful
                featured above.
              </p>
              <span className="read-more">Browse All Recaps →</span>
            </Link>
          </div>

          {/* One ad slot per 3 articles -- currently a single group of
              3, so this sits right after it; if more articles are
              added later this is the spot to repeat the pattern
              every 3rd card rather than add a slot per article. */}
          <div className="mobile-ad-wrap" aria-label="Promotional space">
            <MobileAdFrame>
              <AdUnit kind="mobile" />
              <span className="slot-label">Ad space</span>
            </MobileAdFrame>
          </div>
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

      <footer className="site-footer">
        <p>
          Every final game gets a real, written recap -- browse the{" "}
          <Link href="/stories">full archive</Link>.
        </p>
      </footer>
    </>
  );
}
