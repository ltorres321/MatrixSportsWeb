-- Adds an explicit featured window (featured_from/featured_until) to
-- stories -- currently only ever set for a weekly performance review
-- (universal_game_id IS NULL), never for a per-game recap (those keep
-- using isStoryFeatured's published_at-relative Tuesday-cutoff logic
-- in src/lib/stories.ts, unchanged).
--
-- WHY THIS NEEDED ITS OWN COLUMNS rather than deriving the window from
-- published_at the way per-game recaps do: published_at is stamped by
-- Postgres's own now() the moment an admin clicks Publish at
-- /admin/stories -- a real human action with no fixed timing. But the
-- window a performance review should be "featured" for is meant to
-- track the underlying NFL WEEK it's about (Tuesday 12am ET through
-- Thursday 6pm ET of the week the games were actually played), not
-- however long it happens to take someone to approve the draft. So
-- SportsLLM (a separate repo) computes both timestamps up front, from
-- the week's real last game_date, at INSERT time -- see that repo's
-- src/lib/featuredWindow.ts and src/lib/publishStory.ts.
--
-- Run once against the database DATABASE_URL points at:
--   psql "$DATABASE_URL" -f sql/011_stories_featured_window.sql

ALTER TABLE stories ADD COLUMN IF NOT EXISTS featured_from TIMESTAMPTZ;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS featured_until TIMESTAMPTZ;
