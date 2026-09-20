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
}

// Recaps only stay featured on the home page through 7pm ET on the
// Tuesday after they publish -- past that, ESPN fills the slot
// instead of a week-old recap sitting there indefinitely. Every real
// recap auto-publishes Tuesday ~8am ET (the weekly-stories.mts cron,
// right after Monday Night wraps), so this normally gives an ~11hr
// window; the "next Tuesday on/after" logic is what a manually
// re-published or late-generated story falls back to. Same DST
// caveat as the cron schedules elsewhere in this codebase (assumes
// EDT/UTC-4 -- needs manual adjustment for winter/EST). A plain
// function (not a component), deliberately, so it can call Date.now()
// without tripping the React Compiler's component-purity lint rule --
// see page.tsx's history for why that matters here.
export function isStoryFeatured(story: Story): boolean {
  if (!story.published_at) return true;
  const from = new Date(story.published_at);
  const day = from.getUTCDay(); // Sun=0 .. Tue=2 .. Sat=6
  const daysUntilTuesday = (2 - day + 7) % 7;
  const cutoff = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + daysUntilTuesday, 23, 0, 0)
  );
  if (cutoff.getTime() < from.getTime()) cutoff.setUTCDate(cutoff.getUTCDate() + 7);
  return Date.now() < cutoff.getTime();
}

// Same idea as isStoryFeatured, but for the weekly performance-review
// article (universal_game_id IS NULL), which runs on its own cadence:
// SportsLLM's job runs Tuesday 8am ET, but the story still needs
// manual approval at /admin/stories before published_at is set -- so
// this stays featured through 6pm ET the THURSDAY after it actually
// goes live, not a fixed number of hours after Tuesday. Explicitly
// asked for by the user ("as a feature article on the site until
// Thursday 6PM") rather than mirroring isStoryFeatured's Tuesday
// window, since this content's whole cadence (weekly cycle, review
// gate) is different from the per-game recap's same-day auto-publish.
// Same DST caveat as every other ET-based schedule in this codebase
// (assumes EDT/UTC-4 -- needs manual adjustment for winter/EST).
export function isPerformanceReviewFeatured(story: Story): boolean {
  if (!story.published_at) return true;
  const from = new Date(story.published_at);
  const day = from.getUTCDay(); // Sun=0 .. Thu=4 .. Sat=6
  const daysUntilThursday = (4 - day + 7) % 7;
  const cutoff = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + daysUntilThursday, 22, 0, 0) // 6pm ET = 22:00 UTC (EDT)
  );
  if (cutoff.getTime() < from.getTime()) cutoff.setUTCDate(cutoff.getUTCDate() + 7);
  return Date.now() < cutoff.getTime();
}

// Newest first, no admin gate -- this is what the public site reads.
export async function getPublishedStories(limit = 6): Promise<Story[]> {
  return query<Story>(
    `SELECT id, season, week, universal_game_id, headline, body, source_facts, status, created_at, published_at
     FROM stories WHERE status = 'published' ORDER BY published_at DESC LIMIT $1`,
    [limit]
  );
}

// The published recap for one specific game, if one exists -- what
// the game detail page shows under "Prediction vs. Result". A game
// can have at most one story (stories.universal_game_id is UNIQUE),
// so this is a lookup, not a list.
export async function getStoryForGame(universalGameId: string): Promise<Story | null> {
  const rows = await query<Story>(
    `SELECT id, season, week, universal_game_id, headline, body, source_facts, status, created_at, published_at
     FROM stories WHERE universal_game_id = $1 AND status = 'published' LIMIT 1`,
    [universalGameId]
  );
  return rows[0] ?? null;
}

// A single published story by id, regardless of whether it's tied to
// a game -- what the standalone article page (/stories/[id]) reads.
// No admin gate (public page), but still 'published'-only: a draft
// awaiting approval at /admin/stories must not be reachable by a
// direct link either.
export async function getStoryById(id: string): Promise<Story | null> {
  const rows = await query<Story>(
    `SELECT id, season, week, universal_game_id, headline, body, source_facts, status, created_at, published_at
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
    `SELECT id, season, week, universal_game_id, headline, body, source_facts, status, created_at, published_at
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
    `SELECT id, season, week, universal_game_id, headline, body, source_facts, status, created_at, published_at
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
