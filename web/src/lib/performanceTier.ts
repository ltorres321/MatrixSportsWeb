import "server-only";
import type { Story } from "@/lib/stories";

// Same three tiers as SportsLLM's own generateStory.ts (a separate
// repo -- duplicated here rather than imported, same "each project
// re-derives what it needs" reasoning as elsewhere in this codebase
// family) -- matched to the three hero images a designer produced for
// this feature (public/assets/icons/ModelPerformaceImage_MX_*.png).
export type PerformanceTier = "rough" | "solid" | "gold";

export function performanceTier(accuracyPct: number): PerformanceTier {
  if (accuracyPct <= 64) return "rough";
  if (accuracyPct <= 86) return "solid";
  return "gold";
}

const TIER_IMAGE_PATH: Record<PerformanceTier, string> = {
  rough: "/assets/icons/ModelPerformaceImage_MX_0-64.png",
  solid: "/assets/icons/ModelPerformaceImage_MX_65-86.png",
  gold: "/assets/icons/ModelPerformaceImage_MX_87-100.png",
};

export function performanceTierImagePath(accuracyPct: number): string {
  return TIER_IMAGE_PATH[performanceTier(accuracyPct)];
}

// Pulls straight_up_accuracy back out of a performance-review story's
// source_facts (WeeklyPerformanceFacts, written by SportsLLM) -- that
// column is untyped JSONB (Record<string, unknown>) from this repo's
// side, so this is the one place that trusts its shape. Returns null
// for anything that isn't a performance review (a per-game recap's
// source_facts has a different shape entirely) or has a malformed
// value, so callers never render a tier image for the wrong content.
export function accuracyPctFromStory(story: Story): number | null {
  const raw = story.source_facts?.straight_up_accuracy;
  return typeof raw === "number" ? Math.round(raw * 100) : null;
}
