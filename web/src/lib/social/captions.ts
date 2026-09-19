// Post text to go alongside each rendered image -- kept separate from
// the render functions since the caption is plain text (goes straight
// into a platform's post body / alt text), not part of the PNG.
import { teamByAlias } from "@/lib/teams";
import type { Matchup } from "@/lib/matchups";
import { getWeekRecord, getBestPick, getBiggestMiss, type WeeklyInsight } from "./weeklyStats";

function teamDisplay(alias: string): string {
  const team = teamByAlias(alias);
  return team ? `${team.market} ${team.name}` : alias;
}

export type Platform = "facebook" | "x" | "linkedin" | "instagram";
export const PLATFORMS: Platform[] = ["facebook", "x", "linkedin", "instagram"];

// UTM-tagged per platform so Google Analytics (already installed --
// see components/GoogleAnalytics.tsx) can attribute traffic reliably.
// A raw referrer alone doesn't cut it here: Instagram never sends one
// at all since its caption text is never clickable regardless of
// format, and Facebook/Instagram/X's in-app browsers often strip or
// generic-ize the referrer even when a link IS clickable elsewhere.
// Instagram gets "Link in bio" instead of a URL for that same reason
// -- the bio link itself should carry its own utm_source=instagram
// tag, a one-time manual change in the Instagram app, not generated
// per-post here.
function siteLink(platform: Platform, campaign: string): string {
  if (platform === "instagram") return "Link in bio";
  return `https://matrixsports.net/?utm_source=${platform}&utm_medium=social&utm_campaign=${campaign}`;
}

export function spotlightCaption(matchup: Matchup, platform: Platform): string {
  const favored = (matchup.teamA.prob ?? 0) >= (matchup.teamB.prob ?? 0) ? matchup.teamA : matchup.teamB;
  const probLine =
    favored.prob !== undefined
      ? `Our model gives ${teamByAlias(favored.alias)?.name ?? favored.alias} a ${favored.prob}% win probability after 100,000 simulations.`
      : "";

  return [
    `🔥 ${matchup.premierLabel ?? "Game of the Week"} (free preview): ${teamDisplay(matchup.teamA.alias)} @ ${teamDisplay(matchup.teamB.alias)} — ${matchup.kickoff}`,
    "",
    probLine,
    "",
    `Full breakdown, free → ${siteLink(platform, "premier_game")}`,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

// Grounded entirely in real DB data (record + the week's single most
// confident correct/incorrect call) -- deliberately doesn't attempt
// to explain WHY a pick landed or missed (injuries, weather,
// turnovers, etc.), since this pipeline has no data source for that
// and fabricating plausible-sounding reasons would just be making
// things up under the brand's name. That "why" layer would need
// either a real contextual data feed or an LLM narrative (the
// existing weekly-stories.mts/storiesCore.ts pipeline already does
// something similar for individual games) -- a reasonable follow-up,
// not attempted here.
export function recapCaption(season: number, week: number, matchups: Matchup[], platform: Platform): string {
  const record = getWeekRecord(matchups);
  const wrong = record.total - record.correct;
  const pct = record.total > 0 ? Math.round((record.correct / record.total) * 100) : 0;
  const bestPick = getBestPick(matchups);
  const biggestMiss = getBiggestMiss(matchups);

  const lines = [`📊 Week ${week} model record: ${record.correct}-${wrong} (${pct}%)`, ""];

  if (bestPick) {
    const winner = bestPick.matchup.teamA.winner ? bestPick.matchup.teamA : bestPick.matchup.teamB;
    lines.push(`✅ Best call: ${teamDisplay(winner.alias)} won as our ${bestPick.winProb}% favorite.`);
  }
  if (biggestMiss) {
    const favored =
      (biggestMiss.matchup.teamA.prob ?? 0) >= (biggestMiss.matchup.teamB.prob ?? 0)
        ? biggestMiss.matchup.teamA
        : biggestMiss.matchup.teamB;
    const other = favored === biggestMiss.matchup.teamA ? biggestMiss.matchup.teamB : biggestMiss.matchup.teamA;
    lines.push(
      `❌ Biggest miss: ${teamDisplay(favored.alias)} was a ${biggestMiss.winProb}% favorite and lost to ${teamDisplay(other.alias)}.`
    );
  }

  lines.push(
    "",
    `${record.total} game${record.total === 1 ? "" : "s"}, ${season} season.`,
    "",
    `See every pick → ${siteLink(platform, "weekly_recap")}`
  );
  return lines.join("\n");
}

export function insightCaption(insight: WeeklyInsight, platform: Platform): string {
  const { matchup } = insight;
  const matchupLine = `${teamDisplay(matchup.teamA.alias)} ${matchup.teamA.score} — ${matchup.teamB.score} ${teamDisplay(matchup.teamB.alias)}`;
  const link = siteLink(platform, "weekly_insight");

  if (insight.kind === "bestPick") {
    return [
      `🎯 Model's best call of the week`,
      "",
      matchupLine,
      `Called at ${insight.winProb}% before kickoff — and nailed it.`,
      "",
      link,
    ].join("\n");
  }

  return [
    `😬 Closest game of the week`,
    "",
    matchupLine,
    `Decided by just ${insight.margin} point${insight.margin === 1 ? "" : "s"}.`,
    "",
    link,
  ].join("\n");
}
