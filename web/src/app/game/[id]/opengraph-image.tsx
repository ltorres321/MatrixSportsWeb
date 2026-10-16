import { renderPickCard, size, contentType } from "./pickCardImage";

export const runtime = "nodejs";
export const alt = "Matrix Sports Analytics — matchup prediction";
export { size, contentType };

// Without this, Next treats the route as fully dynamic (renderPickCard
// reads straight from Postgres, not fetch(), so Next can't tell it's
// cacheable) -- every single view regenerated the image from scratch,
// including its own full getGameDetail() call, measured at 1.5-1.7s
// per request in production. 600s (10 min) is a pragmatic middle
// ground: short enough that a live/upcoming game's score or win
// probability doesn't go stale for long, long enough that the
// /stories archive and homepage recap teasers (which can all
// reference the same game's image) stop paying full regeneration cost
// on every view. Must be a literal number, not an expression -- Next
// requires this to be statically analyzable.
export const revalidate = 600;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return renderPickCard(id);
}
