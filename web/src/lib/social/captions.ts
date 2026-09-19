// Post text to go alongside each rendered image -- kept separate from
// the render functions since the caption is plain text (goes straight
// into a platform's post body / alt text), not part of the PNG.
import { teamByAlias } from "@/lib/teams";
import type { Matchup } from "@/lib/matchups";
import type { WeekRecord, WeeklyInsight } from "./weeklyStats";

function teamDisplay(alias: string): string {
  const team = teamByAlias(alias);
  return team ? `${team.market} ${team.name}` : alias;
}

export function spotlightCaption(matchup: Matchup): string {
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
    "Full breakdown, free → matrixsports.net",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export function recapCaption(season: number, week: number, record: WeekRecord): string {
  const wrong = record.total - record.correct;
  const pct = record.total > 0 ? Math.round((record.correct / record.total) * 100) : 0;

  return [
    `📊 Week ${week} model record: ${record.correct}-${wrong} (${pct}%)`,
    "",
    `${record.total} games, ${season} season.`,
    "",
    "See every pick → matrixsports.net",
  ].join("\n");
}

export function insightCaption(insight: WeeklyInsight): string {
  const { matchup } = insight;
  const matchupLine = `${teamDisplay(matchup.teamA.alias)} ${matchup.teamA.score} — ${matchup.teamB.score} ${teamDisplay(matchup.teamB.alias)}`;

  if (insight.kind === "bestPick") {
    return [
      `🎯 Model's best call of the week`,
      "",
      matchupLine,
      `Called at ${insight.winProb}% before kickoff — and nailed it.`,
      "",
      "matrixsports.net",
    ].join("\n");
  }

  return [
    `😬 Closest game of the week`,
    "",
    matchupLine,
    `Decided by just ${insight.margin} point${insight.margin === 1 ? "" : "s"}.`,
    "",
    "matrixsports.net",
  ].join("\n");
}
