import "server-only";
import { query } from "@/lib/db";
import { getCurrentAdminUserId } from "@/lib/admin";
import { getPremierGame } from "@/lib/predictions";

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

// Published stories whose game was that week's premier "Game of the
// Week" -- the home page only ever surfaces premier-game recaps
// (at most `limit` of them), not just whichever stories are newest.
// Pulls a wider batch of recent published stories first, then checks
// each one's (season, week) against the real premier-game selection
// for that week -- getPremierGame() is deterministic for a fully-past
// week (every game's final, so it's just picking the highest-
// confidence one), so this stays stable once a week is over.
export async function getPremierGameStories(limit = 2): Promise<Story[]> {
  const candidates = await query<Story>(
    `SELECT id, season, week, universal_game_id, headline, body, source_facts, status, created_at, published_at
     FROM stories WHERE status = 'published' AND universal_game_id IS NOT NULL
     ORDER BY published_at DESC LIMIT 20`
  );

  const premierCache = new Map<string, string | null>();
  const result: Story[] = [];

  for (const story of candidates) {
    if (result.length >= limit) break;
    const cacheKey = `${story.season}-${story.week}`;
    if (!premierCache.has(cacheKey)) {
      const premier = await getPremierGame(story.season, story.week);
      premierCache.set(cacheKey, premier?.id ?? null);
    }
    if (premierCache.get(cacheKey) === story.universal_game_id) {
      result.push(story);
    }
  }

  return result;
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
