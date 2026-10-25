import "server-only";
import { getLeagueTeamBoxTotals, rankWithTies, type TeamBoxTotals, type StatWithRank } from "@/lib/nbaTeamBoxTotals";

// NBA equivalent of pffGrades.ts's getGameTeamGrades() -- the NFL
// page's "Team Grades" card, side-by-side team production ranked
// against the rest of the league. There's no NBA analogue of PFF's
// own 0-100 team grades, so this computes the standard "Core Four" /
// "Four Factors" / "Net Efficiency" numbers (Dean Oliver's own
// formulas, same ones basketball-reference's and NBA.com's team pages
// use) from nbaTeamBoxTotals.ts's shared per-team season totals --
// see that file's own header for the real data source (hoopR's
// nba.team_box_scores), why "as of a game's date" needs no
// snapshot-staleness logic, and why this is scoped to regular season
// only. nbaEfficiencyScoring.ts (the Offense/Defense per-100-poss
// card) is built from that same shared module.

export type { StatWithRank as TeamStatWithRank };

export interface TeamGradeSet {
  alias: string;
  gamesPlayed: number;
  ppg: StatWithRank;
  rpg: StatWithRank;
  apg: StatWithRank;
  pace: StatWithRank;
  efgPct: StatWithRank;
  tovPct: StatWithRank;
  orebPct: StatWithRank;
  ftRate: StatWithRank;
  offRtg: StatWithRank;
  defRtg: StatWithRank;
  netRtg: StatWithRank;
}

export interface GameTeamGrades {
  home: TeamGradeSet;
  away: TeamGradeSet;
  totalTeams: number;
}

interface TeamDerived {
  alias: string;
  gamesPlayed: number;
  ppg: number;
  rpg: number;
  apg: number;
  pace: number;
  efgPct: number;
  tovPct: number;
  orebPct: number;
  ftRate: number;
  offRtg: number;
  defRtg: number;
  netRtg: number;
}

// Every stat keyed here EXCEPT tovPct/defRtg is "bigger is better" for
// ranking purposes -- those two are the only ones where a smaller
// number is the good outcome (fewer turnovers, fewer points allowed).
const LOWER_IS_BETTER: Partial<Record<keyof Omit<TeamGradeSet, "alias" | "gamesPlayed">, true>> = {
  tovPct: true,
  defRtg: true,
};

// Every *Pct field (plus ftRate) is a raw 0.0-1.0 FRACTION, not a
// 0-100 number -- a deliberate, uniform convention so the view layer
// always does the same "x100 + %" (or, for ftRate, bref's own
// no-leading-"%" decimal) formatting regardless of which stat it's
// rendering, rather than needing to remember which ones got scaled.
function deriveTeamStats(t: TeamBoxTotals): TeamDerived {
  return {
    alias: t.alias,
    gamesPlayed: t.gamesPlayed,
    ppg: t.pts,
    rpg: t.reb,
    apg: t.ast,
    pace: t.poss,
    efgPct: (t.fgm + 0.5 * t.fg3m) / t.fga,
    tovPct: t.tov / (t.fga + 0.44 * t.fta + t.tov),
    orebPct: t.orb / (t.orb + t.oppDrb),
    ftRate: t.fta / t.fga,
    offRtg: (100 * t.pts) / t.poss,
    defRtg: (100 * t.oppPts) / t.poss,
    netRtg: (100 * t.pts) / t.poss - (100 * t.oppPts) / t.poss,
  };
}

type TeamStatKey = Exclude<keyof TeamDerived, "alias" | "gamesPlayed">;
const STAT_KEYS: TeamStatKey[] = [
  "ppg", "rpg", "apg", "pace", "efgPct", "tovPct", "orebPct", "ftRate", "offRtg", "defRtg", "netRtg",
];

function rankLeague(teams: TeamDerived[]): Map<string, TeamGradeSet> {
  const ranksByTeam = new Map<string, Partial<Record<TeamStatKey, StatWithRank>>>();
  for (const key of STAT_KEYS) {
    const ranked = rankWithTies(teams, (t) => t[key], LOWER_IS_BETTER[key] === true);
    for (const [alias, stat] of ranked) {
      const entry = ranksByTeam.get(alias) ?? {};
      entry[key] = stat;
      ranksByTeam.set(alias, entry);
    }
  }

  const result = new Map<string, TeamGradeSet>();
  for (const team of teams) {
    const ranks = ranksByTeam.get(team.alias)!;
    result.set(team.alias, {
      alias: team.alias,
      gamesPlayed: team.gamesPlayed,
      ppg: ranks.ppg!,
      rpg: ranks.rpg!,
      apg: ranks.apg!,
      pace: ranks.pace!,
      efgPct: ranks.efgPct!,
      tovPct: ranks.tovPct!,
      orebPct: ranks.orebPct!,
      ftRate: ranks.ftRate!,
      offRtg: ranks.offRtg!,
      defRtg: ranks.defRtg!,
      netRtg: ranks.netRtg!,
    });
  }
  return result;
}

export async function getGameTeamGrades(
  season: number,
  gameDate: Date,
  homeTeam: string,
  awayTeam: string
): Promise<GameTeamGrades | null> {
  const totals = await getLeagueTeamBoxTotals(season, gameDate);
  if (totals.length === 0) return null;

  const ranked = rankLeague(totals.map(deriveTeamStats));
  const home = ranked.get(homeTeam);
  const away = ranked.get(awayTeam);
  if (!home || !away) return null;

  return { home, away, totalTeams: totals.length };
}
