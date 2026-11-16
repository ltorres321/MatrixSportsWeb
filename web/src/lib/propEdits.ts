import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PropEditRow } from "@/lib/propEditMath";

// Reads "Line Edit" overrides (user, 2026-11-15) for the signed-in user
// -- see sql/018_user_prop_edits.sql's own header for why these live in
// a separate table the site's own parlay construction/grading never
// reads. Pages fetch this once per request and each card applies a
// user's own edits, if any, purely as a display overlay (propEditMath.ts,
// which also owns buildPickKey -- kept out of this server-only file so
// card components can build a pick's key without pulling in a
// "server-only" import) after the official parlay is already decided.
export async function getUserPropEdits(
  supabase: SupabaseClient,
  userId: string | null | undefined
): Promise<Record<string, PropEditRow>> {
  if (!userId) return {};
  const { data } = await supabase
    .from("user_prop_edits")
    .select("pick_key, edited_line, edited_side, edited_odds")
    .eq("user_id", userId);
  const out: Record<string, PropEditRow> = {};
  for (const row of (data ?? []) as {
    pick_key: string;
    edited_line: number;
    edited_side: "over" | "under";
    edited_odds: number;
  }[]) {
    out[row.pick_key] = { pickKey: row.pick_key, line: row.edited_line, side: row.edited_side, odds: row.edited_odds };
  }
  return out;
}
