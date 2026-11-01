"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

// Controls the ?hideBanned= query param both getGameBettingEdge and
// getLeagueBettingEdge (pffBettingEdge.ts) read server-side to decide
// whether tonybet/stoiximan picks get swapped for a legal-book backup
// (or dropped, for First Touchdown, which has no backup data source --
// see that query's own comment). A URL param, not localStorage, because
// this has to reach the SERVER query that builds the actual parlay
// combinations -- a client-side-only filter can't correctly recompute
// a parlay's combined payout after swapping one leg's price.
//
// Default ON (the param's absence means hidden, same as the server
// default) -- toggling just adds/removes an explicit "0".
function ToggleButton() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hidden = searchParams.get("hideBanned") !== "0";

  function toggle() {
    const next = new URLSearchParams(searchParams.toString());
    if (hidden) {
      next.set("hideBanned", "0");
    } else {
      next.delete("hideBanned");
    }
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={`parlay-toggle${hidden ? " on" : ""}`}
      aria-pressed={hidden}
      title="TonyBet and Stoiximan aren't legally available to US bettors -- picks at those books are swapped for the best legal-book price when one exists, or dropped when it doesn't."
    >
      <span className="parlay-toggle-track">
        <span className="parlay-toggle-thumb" />
      </span>
      Filter Banned US Books
    </button>
  );
}

// useSearchParams() needs a Suspense boundary to render on the server at
// all -- without one, Next.js de-opts this subtree to client-only
// rendering, so the button would be entirely absent from the initial
// HTML and only pop in after hydration. The fallback matches the
// default (hidden=true, i.e. "on") state so there's no visible flip.
export function BannedBooksToggle() {
  return (
    <Suspense
      fallback={
        <button type="button" className="parlay-toggle on" aria-pressed disabled>
          <span className="parlay-toggle-track">
            <span className="parlay-toggle-thumb" />
          </span>
          Filter Banned US Books
        </button>
      }
    >
      <ToggleButton />
    </Suspense>
  );
}
