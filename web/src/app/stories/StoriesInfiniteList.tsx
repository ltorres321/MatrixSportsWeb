"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Story } from "@/lib/stories";
import StoryCard from "./StoryCard";

// Loads more as the reader scrolls (same pattern PFF's own list pages
// use) instead of rendering the whole, ever-growing archive in one
// server response -- explicit ask 2026-10-16, since every card's image
// is a dynamically-rendered route (opengraph-image.tsx), and the full
// list was only going to get longer as the season goes on (288+ games
// by season's end). The page itself still server-renders the first
// batch for a fast first paint and so the page works without JS at
// all; this only takes over for everything after that.
//
// page.tsx mounts this with key={activeWeek ?? "all"} -- switching the
// week filter is a real navigation to a new URL, which React treats as
// a fresh mount of this component (not a prop update to the same
// instance) specifically because of that key, so state here never
// needs to be manually reset when the filter changes.
export default function StoriesInfiniteList({
  initialStories,
  initialHasMore,
  week,
}: {
  initialStories: Story[];
  initialHasMore: boolean;
  // Current week filter (or null for "All Weeks") -- passed through to
  // every subsequent fetch so pagination stays within the same filter
  // the reader is looking at.
  week: number | null;
}) {
  const [stories, setStories] = useState(initialStories);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    setLoading((currentlyLoading) => {
      if (currentlyLoading) return currentlyLoading;
      return true;
    });
  }, []);

  // Separate effect (rather than doing the fetch directly inside
  // loadMore) so the actual fetch only ever runs once per `loading`
  // flip to true, regardless of how many times the IntersectionObserver
  // below re-creates its callback.
  useEffect(() => {
    if (!loading) return;
    let cancelled = false;

    (async () => {
      try {
        const params = new URLSearchParams({ offset: String(stories.length) });
        if (week != null) params.set("week", String(week));
        const res = await fetch(`/api/stories?${params}`);
        if (!res.ok) throw new Error(`${res.status}`);
        const data: { stories: Story[]; hasMore: boolean } = await res.json();
        if (cancelled) return;
        setStories((prev) => [...prev, ...data.stories]);
        setHasMore(data.hasMore);
      } catch (err) {
        console.error("Failed to load more stories:", err);
        // hasMore stays true so the sentinel can retry on the next
        // scroll/intersection rather than silently capping the list.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, stories.length, week]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "400px" } // start loading before the reader actually hits bottom
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  return (
    <>
      <div className="news-grid">
        {stories.map((story) => (
          <StoryCard key={story.id} story={story} />
        ))}
      </div>

      {hasMore && (
        <div ref={sentinelRef} style={{ textAlign: "center", padding: "2rem 0", color: "var(--text-dim)" }}>
          {loading ? "Loading more…" : ""}
        </div>
      )}
    </>
  );
}
