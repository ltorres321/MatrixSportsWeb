import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_ODDS_FORMAT, type OddsFormat } from "@/lib/oddsFormat";

// Reads "Site Odds Preference" (profiles.odds_format, sql/019) --
// mirrors sportsbookPrefs.ts's getUserEnabledBooks (same "anonymous/
// not-yet-set visitor gets the default, never an error" contract).
export async function getUserOddsFormat(
  supabase: SupabaseClient,
  userId: string | null | undefined
): Promise<OddsFormat> {
  if (!userId) return DEFAULT_ODDS_FORMAT;
  const { data } = await supabase.from("profiles").select("odds_format").eq("id", userId).single();
  const value = data?.odds_format as OddsFormat | null;
  return value ?? DEFAULT_ODDS_FORMAT;
}
