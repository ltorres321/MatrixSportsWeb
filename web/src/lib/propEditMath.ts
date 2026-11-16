// Pure math for "Line Edit" (user, 2026-11-15): a signed-in user can try
// a different odds/line/over-under on one leg of an already-built
// parlay and see how that leg's own probability and the tile's combined
// payout would change. No I/O here -- propEdits.ts owns fetching/saving
// the edit itself, and each card component (ParlayCard.tsx,
// NbaParlayCard.tsx) decides when to apply one. Site-derived parlay
// construction and grading never call into this file (see sql/018's own
// header for why that boundary matters).

export interface ProbabilityEstimateInput {
  // The model's point projection for this stat -- null falls back to
  // treating the ORIGINAL line as the center of the distribution, which
  // just means "no edit-driven shift" rather than a crash.
  projection: number | null;
  originalLine: number;
  originalSide: "over" | "under";
  // The model's own probability (0-1) for the original line/side --
  // used to back out an implied spread (see recomputeProbability).
  originalProbability: number;
}

export interface LineEditRequest {
  newLine: number;
  newSide: "over" | "under";
}

// Standard Abramowitz & Stegun 7.1.26 erf approximation (accurate to
// ~1.5e-7) -- good enough for a display-only probability estimate, no
// external stats library needed for this.
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * ax);
  const y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-ax * ax);
  return sign * y;
}

function normCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

// Peter Acklam's rational approximation of the inverse standard-normal
// CDF (accurate to ~1.15e-9 across (0,1)).
function invNormCdf(p: number): number {
  const pc = Math.min(Math.max(p, 1e-10), 1 - 1e-10);
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239e0];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838e0, -2.549732539343734e0, 4.374664141464968e0, 2.938163982698783e0];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e0, 3.754408661907416e0];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  if (pc < pLow) {
    const q = Math.sqrt(-2 * Math.log(pc));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (pc <= pHigh) {
    const q = pc - 0.5;
    const r = q * q;
    return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  const q = Math.sqrt(-2 * Math.log(1 - pc));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

// How wide we assume the stat's spread is, as a fraction of the
// projection, ONLY when the original pick can't pin down an implied
// sigma (originalProbability essentially 50/50 and/or the projection
// sits right on the original line -- both make
// signedDistance/invNormCdf(p) numerically unstable, i.e. a near-zero
// divide). There's no model call to fall back on here -- this whole
// module is a display-only estimate (see the module header), never fed
// back into grading or site-derived records.
const FALLBACK_SIGMA_FRACTION = 0.2;
const MIN_FALLBACK_SIGMA = 0.5;

// Models the stat as Normal(projection, sigma), backs sigma out of the
// ORIGINAL pick (its own line/side/probability), then applies that same
// sigma to the new line/side. An approximation, not a call into the
// prediction model -- flagged to the user wherever this is displayed.
export function recomputeProbability(input: ProbabilityEstimateInput, edit: LineEditRequest): number {
  const center = input.projection ?? input.originalLine;
  const signedDistance0 = input.originalSide === "over" ? center - input.originalLine : input.originalLine - center;
  const z0 = invNormCdf(Math.min(Math.max(input.originalProbability, 0.02), 0.98));
  let sigma = z0 !== 0 ? signedDistance0 / z0 : NaN;
  if (!Number.isFinite(sigma) || sigma <= 0) {
    sigma = Math.max(Math.abs(center) * FALLBACK_SIGMA_FRACTION, MIN_FALLBACK_SIGMA);
  }
  const signedDistanceNew = edit.newSide === "over" ? center - edit.newLine : edit.newLine - center;
  const probability = normCdf(signedDistanceNew / sigma);
  return Math.min(Math.max(probability, 0.01), 0.99);
}

export function americanToDecimal(odds: number): number {
  return odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds);
}

export interface PropEditRow {
  pickKey: string;
  line: number;
  side: "over" | "under";
  odds: number;
}

// Stable identity for a pick's edit row -- ALWAYS built from the pick's
// ORIGINAL (site-derived) line/side, never from an already-edited
// display value, so reopening the editor on an already-edited leg still
// finds its row (the stored line/side/odds are the VALUES, not part of
// the key). Pure (no I/O) so both the server-only data layer
// (propEdits.ts) and the display components (ParlayCard.tsx,
// NbaParlayCard.tsx) can call it without pulling in a "server-only"
// import.
//
// `scope` disambiguates which game/week/day the pick belongs to, since
// the same player+stat can otherwise recur across the season:
//   - NFL per-game page (app/game/[id]):      `game:${universalGameId}`
//   - NFL league page (app/parlays):          `week:${season}-${week}`
//   - NBA per-game page (app/nba/game/[id]):  `game:${nbaGameId}`
//   - NBA league page (app/parlays/nba):      `day:${dayKey}`
// A per-game page and the league-wide page use different scope prefixes
// for what's really the same real-world pick -- an edit made on one
// doesn't carry over to the other. Accepted as a known limitation rather
// than threading one global pick id across both view types, which isn't
// available end-to-end today.
export function buildPickKey(parts: {
  league: "nfl" | "nba";
  scope: string;
  player: string;
  stat: string;
  originalLine: number;
  originalSide: string;
}): string {
  return [parts.league, parts.scope, parts.player, parts.stat, parts.originalLine, parts.originalSide].join("::");
}

// "This bet only" vs "All matching props" (user, 2026-11-15): the same
// pick can be a leg in several different parlay tiles within one scope
// (e.g. both "2-Leg Parlay 1" and "3-Leg Parlay"), and editing it used to
// change every one of them -- surprising when the player only meant to
// try something on the one slip they were looking at. buildTileEditKey
// derives a SECOND, more specific key (scoped to one tile) alongside
// buildPickKey's broader one. The two are mutually exclusive in practice
// -- PropEditButton.tsx's save() always deletes whichever key the toggle
// did NOT pick, so at most one row exists per (user, pick) -- but
// resolveSavedEdit still checks the tile-specific key first in case a
// stale row from before that cleanup existed ever lingers.
export type EditScope = "tile" | "all";

export function buildTileEditKey(pickKey: string, tileId: string): string {
  return `${pickKey}::tile::${tileId}`;
}

export interface ResolvedEdit {
  row: PropEditRow;
  appliesTo: EditScope;
}

export function resolveSavedEdit(
  propEdits: Record<string, PropEditRow>,
  pickKeyAll: string,
  pickKeyTile: string
): ResolvedEdit | null {
  const tileRow = propEdits[pickKeyTile];
  if (tileRow) return { row: tileRow, appliesTo: "tile" };
  const allRow = propEdits[pickKeyAll];
  if (allRow) return { row: allRow, appliesTo: "all" };
  return null;
}

export interface LegDisplayInput {
  projection: number | null;
  originalLine: number;
  originalSide: "over" | "under";
  originalProbability: number;
  originalOdds: number;
}

export interface SavedLineEdit {
  line: number;
  side: "over" | "under";
  odds: number;
}

export interface LegDisplay {
  line: number;
  side: "over" | "under";
  odds: number;
  probability: number;
  decimalOdds: number;
  edited: boolean;
}

// What ParlayCard.tsx/NbaParlayCard.tsx actually render for one leg --
// the pick's own site-derived values, or (when the user has a saved
// Line Edit for this leg) the edited odds/line/side with probability
// recomputed via recomputeProbability above. Never mutates the
// underlying Parlay/NbaParlay the site built -- this is a display-only
// transform each card applies on top of it.
export function applyLineEdit(input: LegDisplayInput, edit: SavedLineEdit | undefined): LegDisplay {
  if (!edit) {
    return {
      line: input.originalLine,
      side: input.originalSide,
      odds: input.originalOdds,
      probability: input.originalProbability,
      decimalOdds: americanToDecimal(input.originalOdds),
      edited: false,
    };
  }
  const probability = recomputeProbability(
    {
      projection: input.projection,
      originalLine: input.originalLine,
      originalSide: input.originalSide,
      originalProbability: input.originalProbability,
    },
    { newLine: edit.line, newSide: edit.side }
  );
  return {
    line: edit.line,
    side: edit.side,
    odds: edit.odds,
    probability,
    decimalOdds: americanToDecimal(edit.odds),
    edited: true,
  };
}
