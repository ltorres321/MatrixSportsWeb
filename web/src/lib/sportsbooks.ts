import { SPORTSBOOK_INFO } from "@/components/ParlayCard";

// The real-money sportsbooks a user can actually pick in "My Bookies".
// Names/display come from SPORTSBOOK_INFO (ParlayCard.tsx) -- the
// SAME map the site already uses to render a book's logo/link next to
// a prop or parlay leg -- so this list can never drift from what the
// site actually displays. This file only curates WHICH of those keys
// belong in the picker: a plain id list, not a second copy of names.
//
// tonybet, bet99, stoiximan, elabet are INCLUDED as of 2026-11-14,
// even though pffBettingEdge.ts's BANNED_US_BOOKS still lists them as
// not legally available to US bettors. That was a single site-wide
// legality guess -- it can't know a given user's own state (the US
// itself has real state-by-state rules on top of the federal
// question) or whether the user isn't even a US bettor at all. "My
// Bookies" lets each user decide that for themselves instead, so the
// blanket rule is suppressed (BANNED_US_BOOKS and its toggle still
// exist in pffBettingEdge.ts, just default off now) rather than
// deleted -- see that file's own comment.
//
// Still excluded, for a different and unrelated reason -- not a
// legality judgment call, a product-category one:
//   - novig, onexbet, pick6 -- exchange/international/DFS-pick'em,
//     not a book with a normal retail wagering account at all (same
//     reasoning as NON_RETAIL_BOOKS there, which stays independent of
//     the legality toggle; pick6 is DraftKings' separate pick'em
//     product, not the same account as a DraftKings sportsbook bet).
// `dst_propbuilder` has no SPORTSBOOK_INFO entry at all (backend odds
// infra, not a book a user can visit), so it was never a candidate.
//
// betonlineag/lowvig/parlayplay/thescorebet added 2026-11-16 (user,
// confirmed live in etl.player_prop_lines_current's own bookmaker
// values): the user's own test for this list is "can a player actually
// create an account and use it," not a second-guessed category --
// betonlineag/lowvig are offshore like bovada/bet99 but usable by US
// bettors, parlayplay takes real-money parlay bets with a real account
// (not DFS pick'em the way pick6 is, despite looking similar), and
// thescorebet is a licensed US real-money book. Don't re-litigate this
// list with a new "but is it really a sportsbook" filter -- BANNED_US_BOOKS
// (pffBettingEdge.ts) and this file are the two lists that matter; a book
// not in NON_RETAIL_BOOKS belongs here once the user confirms it's a real,
// usable account.
const SELECTABLE_BOOK_IDS = [
  "draftkings",
  "fanduel",
  "betmgm",
  "caesars",
  "espnbet",
  "fanatics",
  "bovada",
  "betonlineag",
  "lowvig",
  "parlayplay",
  "thescorebet",
  "hardrock",
  "betrivers",
  "betway",
  "pinnacle",
  "fliff",
  "rebet",
  "sportzino",
  "courtside",
  "unibet",
  "tonybet",
  "bet99",
  "stoiximan",
  "elabet",
] as const;

export interface Sportsbook {
  id: string;
  name: string;
}

export const SPORTSBOOKS: Sportsbook[] = SELECTABLE_BOOK_IDS.map((id) => ({
  id,
  name: SPORTSBOOK_INFO[id]?.name ?? id,
}));

// Sweepstakes social-casino/sportsbooks, not real-money cash books, even
// though they show real-money-style odds here (user, 2026-11-16:
// "sportzino is not real money games", then confirmed Fliff is "the
// same type"). Client-safe (no "server-only" import) so
// SportsbookPickerModal.tsx can gate these pills behind its "coin based
// books" toggle -- pffBettingEdge.ts's DEFAULT_OFF_BOOKS (server-only,
// drives the actual parlay/props filtering) reuses this exact array
// rather than keeping a second copy.
export const COIN_BASED_BOOK_IDS = ["sportzino", "fliff"];
