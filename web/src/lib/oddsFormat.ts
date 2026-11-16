// "Site Odds Preference" (profile page, user 2026-11-16: "American Odds,
// Decimal, Fractional ... this will change how odds are displayed across
// site"). Pure, client-safe (no "server-only" import, same split as
// propEditMath.ts vs propEdits.ts) -- the Supabase read lives in
// oddsFormatPrefs.ts instead, so this file can be imported from both
// server components (ParlayCard.tsx, GameDetailView.tsx, ...) and a
// future client component without pulling in server-only code.
//
// Scope: this changes how a leg/line's own American odds number is
// DISPLAYED (formatOdds's call sites below). It does NOT touch the Line
// Edit modal's odds input (PropEditButton.tsx) or the social share-card
// renderer (lib/social/renderParlayCard.tsx) -- edits are still entered
// and stored as American odds (that's what propEditMath.ts's probability
// recompute expects), and a share image is a public, un-personalized
// asset rendered once for every viewer, so there's no single "whose
// preference" to apply there.

export type OddsFormat = "american" | "decimal" | "fractional";

export const DEFAULT_ODDS_FORMAT: OddsFormat = "american";

export const ODDS_FORMATS: { id: OddsFormat; label: string }[] = [
  { id: "american", label: "American" },
  { id: "decimal", label: "Decimal" },
  { id: "fractional", label: "Fractional" },
];

function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}

// American odds, e.g. -110/+150, are the canonical value stored
// everywhere (parlay legs, prop edits, SQL columns) -- this only
// reformats that SAME number for display, never changes what's stored
// or how probability/payout math is computed from it.
export function formatOdds(odds: number, format: OddsFormat = DEFAULT_ODDS_FORMAT): string {
  if (format === "decimal") {
    const decimal = odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds);
    return decimal.toFixed(2);
  }
  if (format === "fractional") {
    const [numerator, denominator] = odds > 0 ? [odds, 100] : [100, Math.abs(odds)];
    const divisor = gcd(numerator, denominator);
    return `${numerator / divisor}/${denominator / divisor}`;
  }
  return odds > 0 ? `+${odds}` : `${odds}`;
}
