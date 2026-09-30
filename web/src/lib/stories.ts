import "server-only";
import { query } from "@/lib/db";
import { getCurrentAdminUserId } from "@/lib/admin";

export interface Story {
  id: string;
  season: number;
  week: number;
  universal_game_id: string | null;
  headline: string;
  body: string;
  source_facts: Record<string, unknown>;
  status: "draft" | "published" | "rejected";
  created_at: string;
  published_at: string | null;
  // Only ever set for a weekly performance review (universal_game_id
  // IS NULL) -- computed by SportsLLM (a separate repo) from the
  // week's real last game_date, not from published_at. See
  // isPerformanceReviewFeatured below and sql/011_stories_featured_window.sql.
  featured_from: string | null;
  featured_until: string | null;
}

// Recaps only stay featured on the home page through midnight ET at
// the start of the next Thursday -- past that, ESPN fills the slot
// instead of a week-old recap sitting there (explicit ask 2026-09-20:
// a Week 1 recap should be gone before Week 2's Thursday Night
// Football kicks off, not lingering into Sunday).
//
// FIXED 2026-09-20: this used to read the UTC weekday of published_at
// directly, but publishing happens in ET -- a late-evening ET publish
// (e.g. ~10pm Tuesday, from a manual run) is already past midnight
// UTC, so getUTCDay() read it as Wednesday instead of Tuesday. That
// undercounted "days until Thursday" by a full week, leaving Week 1's
// recaps featured for 7+ days instead of the intended ~1-2 day
// window. Fixed by shifting into ET before reading the weekday, same
// EDT/UTC-4 DST caveat as the cron schedules elsewhere in this
// codebase (needs manual adjustment for winter/EST).
//
// A plain function (not a component), deliberately, so it can call
// Date.now() without tripping the React Compiler's component-purity
// lint rule -- see page.tsx's history for why that matters here.
const ET_OFFSET_HOURS = 4;

export function isStoryFeatured(story: Story): boolean {
  if (!story.published_at) return true;
  const from = new Date(story.published_at);
  const etFrom = new Date(from.getTime() - ET_OFFSET_HOURS * 60 * 60 * 1000);
  const day = etFrom.getUTCDay(); // ET weekday: Sun=0 .. Thu=4 .. Sat=6
  // "|| 7" rather than allowing 0: a story published ON a Thursday
  // still gets a real window until the FOLLOWING Thursday, not an
  // instant (zero-width) cutoff.
  const daysUntilThursday = (4 - day + 7) % 7 || 7;
  const cutoffEt = new Date(
    Date.UTC(etFrom.getUTCFullYear(), etFrom.getUTCMonth(), etFrom.getUTCDate() + daysUntilThursday, 0, 0, 0)
  );
  const cutoff = new Date(cutoffEt.getTime() + ET_OFFSET_HOURS * 60 * 60 * 1000);
  return Date.now() < cutoff.getTime();
}

// Unlike isStoryFeatured (which derives its window from published_at,
// computed live on read), a performance review's window is computed
// ONCE by SportsLLM at insert time, from the week's real last
// game_date, and stored in featured_from/featured_until -- see
// sql/011_stories_featured_window.sql for why published_at can't be
// used here (it's stamped by whenever a human clicks Publish, not by
// which NFL week the article is actually about).
//
// Takes `now` explicitly (rather than reading Date.now() internally,
// the way isStoryFeatured does) specifically so a caller can pass
// getEffectiveNow() (admin.ts) -- an admin using the /admin/time
// simulated-clock override to test "does this show up starting
// Tuesday" needs this check to respect that override; a real visitor
// (or the social-caption content-job route) always passes the real
// `new Date()`, which is exactly what getEffectiveNow() itself returns
// for a non-admin/no-override request anyway.
export function isPerformanceReviewFeatured(story: Story, now: Date): boolean {
  if (!story.featured_from || !story.featured_until) return true;
  const from = new Date(story.featured_from).getTime();
  const until = new Date(story.featured_until).getTime();
  return now.getTime() >= from && now.getTime() < until;
}

// Newest first, no admin gate -- this is what the public site reads
// for PER-GAME recaps specifically. Excludes weekly performance
// reviews (universal_game_id IS NULL) -- those have their own
// getLatestPerformanceReview() and their own featured-window logic;
// mixing them in here would render one as a dead, unclickable card
// (this file's callers assume a truthy universal_game_id means "link
// to /game/[id]").
export async function getPublishedStories(limit = 6): Promise<Story[]> {
  return query<Story>(
    `SELECT id, season, week, universal_game_id, headline, body, source_facts, status, created_at, published_at, featured_from, featured_until
     FROM stories WHERE status = 'published' AND universal_game_id IS NOT NULL ORDER BY published_at DESC LIMIT $1`,
    [limit]
  );
}

// Every published weekly performance review, not just the latest --
// what the /stories archive page reads (getLatestPerformanceReview
// above stays as-is for the home page's single featured card).
export async function getPublishedPerformanceReviews(limit = 30): Promise<Story[]> {
  return query<Story>(
    `SELECT id, season, week, universal_game_id, headline, body, source_facts, status, created_at, published_at, featured_from, featured_until
     FROM stories WHERE status = 'published' AND universal_game_id IS NULL ORDER BY published_at DESC LIMIT $1`,
    [limit]
  );
}

// The published recap for one specific game, if one exists -- what
// the game detail page shows under "Prediction vs. Result". A game
// can have at most one story (stories.universal_game_id is UNIQUE),
// so this is a lookup, not a list.
export async function getStoryForGame(universalGameId: string): Promise<Story | null> {
  const rows = await query<Story>(
    `SELECT id, season, week, universal_game_id, headline, body, source_facts, status, created_at, published_at, featured_from, featured_until
     FROM stories WHERE universal_game_id = $1 AND status = 'published' LIMIT 1`,
    [universalGameId]
  );
  return rows[0] ?? null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A single published story by id, regardless of whether it's tied to
// a game -- what the standalone article page (/stories/[id]) reads.
// No admin gate (public page), but still 'published'-only: a draft
// awaiting approval at /admin/stories must not be reachable by a
// direct link either.
//
// Validates the id looks like a UUID before querying -- `id` is a
// Postgres UUID column, so a malformed value (a bot probing
// /stories/whatever, a typo'd link) makes the driver throw a type-cast
// error instead of just matching zero rows, which surfaced as a raw
// 500 rather than the page's own notFound() -- confirmed against the
// live site on 2026-09-20 (/stories/doesnotexist -> 500,
// /stories/<real-shaped-but-missing-uuid> -> a normal 404).
export async function getStoryById(id: string): Promise<Story | null> {
  if (!UUID_RE.test(id)) return null;

  const rows = await query<Story>(
    `SELECT id, season, week, universal_game_id, headline, body, source_facts, status, created_at, published_at, featured_from, featured_until
     FROM stories WHERE id = $1 AND status = 'published' LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

// The most recent published weekly performance-review story -- the
// one kind of story with universal_game_id IS NULL (every per-game
// recap always has one, so this is an unambiguous discriminator, not
// a new column). What the home page's "Weekly Model Performance" card
// and the /api/content-jobs/performance-review social-caption job both
// read. Written by SportsLLM (a separate repo) as a 'draft'; only
// becomes visible here once approved at /admin/stories.
export async function getLatestPerformanceReview(): Promise<Story | null> {
  const rows = await query<Story>(
    `SELECT id, season, week, universal_game_id, headline, body, source_facts, status, created_at, published_at, featured_from, featured_until
     FROM stories WHERE universal_game_id IS NULL AND status = 'published'
     ORDER BY published_at DESC LIMIT 1`
  );
  return rows[0] ?? null;
}

// Admin-only -- see admin_users/getCurrentAdminUserId() for why this
// re-checks admin status itself rather than trusting the caller.
export async function getStoriesForReview(limit = 30): Promise<Story[]> {
  const adminUserId = await getCurrentAdminUserId();
  if (!adminUserId) return [];

  return query<Story>(
    `SELECT id, season, week, universal_game_id, headline, body, source_facts, status, created_at, published_at, featured_from, featured_until
     FROM stories WHERE status IN ('draft', 'published') ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
}

export async function publishStory(id: string): Promise<void> {
  const adminUserId = await getCurrentAdminUserId();
  if (!adminUserId) throw new Error("Not authorized");

  await query("UPDATE stories SET status = 'published', published_at = now() WHERE id = $1 AND status = 'draft'", [id]);
}

export async function rejectStory(id: string): Promise<void> {
  const adminUserId = await getCurrentAdminUserId();
  if (!adminUserId) throw new Error("Not authorized");

  await query("UPDATE stories SET status = 'rejected' WHERE id = $1 AND status = 'draft'", [id]);
}

// Takes a story back down after it's already live -- the safety net
// that matters now that generation auto-publishes with no review
// step first. Same 'rejected' status as rejecting a draft (it just
// means "don't show this publicly" either way), but a separate
// function/WHERE clause so a draft-only reject can't accidentally
// also match a published row, or vice versa.
export async function unpublishStory(id: string): Promise<void> {
  const adminUserId = await getCurrentAdminUserId();
  if (!adminUserId) throw new Error("Not authorized");

  await query("UPDATE stories SET status = 'rejected' WHERE id = $1 AND status = 'published'", [id]);
}
