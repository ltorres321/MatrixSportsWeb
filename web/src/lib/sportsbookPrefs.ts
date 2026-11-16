import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SPORTSBOOKS } from "@/lib/sportsbooks";
import { BANNED_US_BOOKS, DEFAULT_OFF_BOOKS } from "@/lib/pffBettingEdge";

// Wires "My Bookies" (profiles.enabled_sportsbooks, profile page) into
// the actual parlay/betting-edge filtering (user, 2026-11-14). Reads
// the signed-in user's own picks and turns them into the exclusion
// list pffBettingEdge.ts/nbaGameDetail.ts already accept (bannedBooks/
// excludedLineShopBooks/excludedParlayBooks) -- no SQL changes needed,
// those queries just get handed a bigger exclusion list than before.

// Raw picks, straight from the profile. Empty array means "no
// preference set yet" (or not signed in) -- callers treat that as "no
// restriction", the same default-show-everything behavior as before
// this feature existed, never as "show nothing".
export async function getUserEnabledBooks(
  supabase: SupabaseClient,
  userId: string | null | undefined
): Promise<string[]> {
  if (!userId) return [];
  const { data } = await supabase.from("profiles").select("enabled_sportsbooks").eq("id", userId).single();
  return (data?.enabled_sportsbooks as string[] | null) ?? [];
}

// The complement of enabledBooks within the full SPORTSBOOKS catalog --
// ready to spread into an existing exclusion array (bannedBooks, etc.).
// Empty enabledBooks ("no preference") returns DEFAULT_OFF_BOOKS, not []
// -- "no preference" means "show everything real-money", not literally
// everything, and DEFAULT_OFF_BOOKS (sportzino) isn't a real-money book
// (see that list's own comment in pffBettingEdge.ts). A non-empty
// enabledBooks already excludes any book the user didn't pick, sportzino
// included, so this only matters for the all-default case.
export function booksExcludedByUserPref(enabledBooks: string[]): string[] {
  if (enabledBooks.length === 0) return DEFAULT_OFF_BOOKS;
  return SPORTSBOOKS.filter((b) => !enabledBooks.includes(b.id)).map((b) => b.id);
}

// For data that's already baked into one-sportsbook-per-pick rows
// BEFORE the user's own list can reach the query that built them (NBA
// league parlays read a table SportsAnalytics materializes hourly for
// only two fixed variants, hide_banned true/false -- see
// nbaLeagueBettingEdge.ts's own module comment). There's no per-book
// alternative price stored to swap to, so a parlay using a book outside
// the user's picks is dropped whole, not re-priced at a different book
// the way the live-queried pages (game/[id], nba/game/[id], /parlays)
// can. Same "no preference = no restriction" rule as above.
export function filterParlaysToEnabledBooks<T extends { sportsbook: string | null }>(
  parlays: T[],
  enabledBooks: string[]
): T[] {
  // "No preference" still excludes DEFAULT_OFF_BOOKS (sportzino) -- see
  // booksExcludedByUserPref's own comment; a non-empty enabledBooks is
  // already an explicit allow-list, so sportzino only passes through
  // there if the user put it in their own picks.
  if (enabledBooks.length === 0) {
    return parlays.filter((p) => p.sportsbook == null || !DEFAULT_OFF_BOOKS.includes(p.sportsbook));
  }
  return parlays.filter((p) => p.sportsbook != null && enabledBooks.includes(p.sportsbook));
}

// Same filter as above, but never returns an empty result when the
// unfiltered list has something to show (user, 2026-11-15: "I dont want
// blank days. Days need to have some data to fall back on."). Any one
// day's NBA league picks can lean overwhelmingly on a single book (seen
// in practice: one book held the single best price on 60-95% of a day's
// top-ranked picks), so a user whose own books don't include that one
// book can otherwise lose the entire day to filterParlaysToEnabledBooks
// above. Falling back to the unfiltered list keeps a day non-empty; the
// caller is expected to flag `usedFallback` results in the UI so the
// user knows those particular picks aren't necessarily at a book they
// can bet on.
//
// The fallback tier itself is two-deep (user, 2026-11-15: "if you need
// to add filler parlays to avoid empty sets use books that are in the
// US ... Exclude Books not allowed in US for US players"):
//   1. The user's own preferred book(s) -- filterParlaysToEnabledBooks
//      above, unchanged.
//   2. Best available parlay at a book legally available to US bettors.
//   3. If even that's empty, every remaining book -- so a day/week
//      never goes blank just because its only picks happen to sit at a
//      book tier 2 excludes.
//
// REWORKED 2026-11-16 (user: "the US filter not being applied here...
// after no preferred books found lean on US books next", then "sportzino
// is not real money games... filter those games out by default"). The
// first cut of tier 2 filtered BANNED_US_BOOKS out of the SAME `parlays`
// array tier 1 had just emptied -- that array is the page's top-N
// parlays across EVERY book ranked purely by probability, and
// bet99/stoiximan routinely win most or all of those top slots outright
// (confirmed live: a day's entire top-N can be 100% bet99/stoiximan), so
// there was nothing left to find by filtering it again. Tier 2 now takes
// `usAllowedCandidates` from the caller instead -- for the NBA league
// page, nba/page.tsx's loadUsAllowedNbaWeekParlays rebuilds parlays from
// the full raw picks pool with every excluded book's picks dropped
// BEFORE ranking (not a post-filter of an already-capped top-N), so it
// can actually find a different book's combo when one exists. This
// function still strips BANNED_US_BOOKS + DEFAULT_OFF_BOOKS from
// usAllowedCandidates itself as a last-line safety net in case a future
// caller forgets to pre-filter -- cheap, and a no-op when the caller
// already did.
export function filterParlaysToEnabledBooksWithFallback<T extends { sportsbook: string | null }>(
  parlays: T[],
  enabledBooks: string[],
  usAllowedCandidates?: T[]
): { items: T[]; usedFallback: boolean } {
  const filtered = filterParlaysToEnabledBooks(parlays, enabledBooks);
  if (filtered.length > 0 || parlays.length === 0) return { items: filtered, usedFallback: false };

  const usAllowed = (usAllowedCandidates ?? []).filter(
    (p) =>
      p.sportsbook == null || (!BANNED_US_BOOKS.includes(p.sportsbook) && !DEFAULT_OFF_BOOKS.includes(p.sportsbook))
  );
  if (usAllowed.length > 0) return { items: usAllowed, usedFallback: true };

  return { items: parlays, usedFallback: true };
}
