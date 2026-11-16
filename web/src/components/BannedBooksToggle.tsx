"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

// NOT RENDERED ANYWHERE as of 2026-11-15 -- "My Bookies" (profile page)
// replaced this toggle everywhere it used to appear (GameDetailView.tsx,
// NbaGameDetailView.tsx, ParlaysView.tsx, NbaParlaysView.tsx). Kept, not
// deleted, same "suppressed not removed" reasoning as the hideBannedBooks
// param itself (pffBettingEdge.ts's BANNED_US_BOOKS comment) -- the
// underlying lib functions now ignore hideBannedBooks entirely, so even
// if this were re-added somewhere, toggling it would currently do
// nothing without also un-suppressing that side.
//
// Controls the ?hideBanned= query param both getGameBettingEdge and
// getLeagueBettingEdge (pffBettingEdge.ts) read server-side to decide
// whether tonybet/stoiximan picks get swapped for a legal-book backup
// (or dropped, for First Touchdown, which has no backup data source --
// see that query's own comment). A URL param, not localStorage, because
// this has to reach the SERVER query that builds the actual parlay
// combinations -- a client-side-only filter can't correctly recompute
// a parlay's combined payout after swapping one leg's price.
//
// SUPPRESSED, NOT DELETED (user, 2026-11-14): the blanket "hide
// non-US-legal books" rule defaulted ON site-wide, but a user's own
// "My Bookies" selection (profile page) is a far better-fitted
// decision than one global legality guess -- so the default flipped
// to OFF (show everything) and this toggle is now an explicit opt-IN
// to the old filter, not an opt-out. Toggling adds/removes "1" (was
// "0" under the old default-hidden behavior).
function ToggleButton() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hidden = searchParams.get("hideBanned") === "1";

  function toggle() {
    const next = new URLSearchParams(searchParams.toString());
    if (hidden) {
      next.delete("hideBanned");
    } else {
      next.set("hideBanned", "1");
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
// default (hidden=false, i.e. "off") state so there's no visible flip.
export function BannedBooksToggle() {
  return (
    <Suspense
      fallback={
        <button type="button" className="parlay-toggle" aria-pressed={false} disabled>
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
