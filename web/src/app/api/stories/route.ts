import { NextResponse } from "next/server";
import { getPublishedStoriesPage } from "@/lib/stories";

const PAGE_SIZE = 18;
const MAX_OFFSET = 10_000; // sane ceiling against a garbage/huge offset param

// Public, unauthenticated -- same published-content-only data the
// /stories page itself already shows anonymously, just paginated.
// Backs that page's infinite scroll (StoriesInfiniteList.tsx): the
// first page is server-rendered by the page itself, every batch after
// that comes from here as the reader scrolls.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const weekParam = url.searchParams.get("week");
  const week = weekParam != null && /^\d+$/.test(weekParam) ? Number(weekParam) : undefined;

  const offsetParam = Number(url.searchParams.get("offset") ?? "0");
  const offset = Number.isInteger(offsetParam) && offsetParam >= 0 && offsetParam <= MAX_OFFSET ? offsetParam : 0;

  const { stories, hasMore } = await getPublishedStoriesPage({ week, offset, limit: PAGE_SIZE });

  return NextResponse.json({ stories, hasMore });
}
