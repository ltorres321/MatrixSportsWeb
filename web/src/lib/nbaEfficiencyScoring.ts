import "server-only";
import { getLeagueTeamBoxTotals, rankWithTies, type TeamBoxTotals, type StatWithRank } from "@/lib/nbaTeamBoxTotals";

// NBA equivalent of GameDetailView.tsx's "Efficiency and Scoring"
// card (EfficiencySection/EfficiencyCard) -- Offense (this team's own
// shooting/rebounding/ballhandling, per 100 possessions) side by side
// with Defense (what the OPPONENT did against this team in those same
// games, i.e. "allowed"), ranked against the rest of the league.
// Built from nbaTeamBoxTotals.ts's shared per-team season totals --
// see that file's header for the real data source, the as-of-date
// semantics, and why this needs no new daily scrape (hoopR's existing
// nba.team_box_scores already has every raw column this table needs:
// FG/3P/FT makes+attempts, ORB/DRB, AST/STL/BLK/TOV/PF, both for a
// team's own box score row and -- via that file's opponent self-join
// -- the opponent's).
//
// PER 100 POSSESSIONS, not per game, matching the exact bref page
// (NBA_{season}_per_poss.html, "Team"/"Opponent" toggle) the user
// pointed at -- percentages (FG%/3P%/2P%/FT%) are scale-invariant
// ratios so those are identical either way, but every counting stat
// (3P, 3PA, 2P, 2PA, FT, FTA, ORB, DRB, STL, BLK, TOV, PF) is divided
// by nbaTeamBoxTotals.ts's own Dean Oliver possession estimate and
// scaled to 100, not just left as a per-game average.
//
// Deliberately leaves out AST and TRB -- both are the exact same raw
// season total nbaTeamGrades.ts's Team Grades card already shows (as
// "Assists"/"Rebounds", per GAME rather than per 100 possessions), so
// showing them a second time here under a different scale would be
// redundant, not new information. Everything else here has no Team
// Grades equivalent (eFG%/TOV%/OREB%/FT Rate there are all different
// formulas, not a FG%/TOV/ORB/FT% restated).

export type { StatWithRank as TeamPer100StatWithRank };

export interface TeamPer100Stats {
  fgPct: StatWithRank;
  threeP: StatWithRank;
  threePA: StatWithRank;
  threePct: StatWithRank;
  twoP: StatWithRank;
  twoPA: StatWithRank;
  twoPct: StatWithRank;
  ft: StatWithRank;
  fta: StatWithRank;
  ftPct: StatWithRank;
  orb: StatWithRank;
  drb: StatWithRank;
  stl: StatWithRank;
  blk: StatWithRank;
  tov: StatWithRank;
  pf: StatWithRank;
}

export interface GameEfficiencyScoring {
  homeOffense: TeamPer100Stats;
  awayOffense: TeamPer100Stats;
  homeDefense: TeamPer100Stats;
  awayDefense: TeamPer100Stats;
  totalTeams: number;
}

interface TeamDerivedPer100 {
  alias: string;
  fgPct: number;
  threeP: number;
  threePA: number;
  threePct: number;
  twoP: number;
  twoPA: number;
  twoPct: number;
  ft: number;
  fta: number;
  ftPct: number;
  orb: number;
  drb: number;
  stl: number;
  blk: number;
  tov: number;
  pf: number;
}

function per100(perGame: number, poss: number): number {
  return (perGame / poss) * 100;
}

// 2P/2PA are bref's own convention: 2-point makes/attempts = overall
// FG/FGA minus the 3-point makes/attempts, not a separately tracked
// column (team_box_scores doesn't have one either).
function deriveSide(t: TeamBoxTotals, side: "offense" | "defense"): TeamDerivedPer100 {
  const fgm = side === "offense" ? t.fgm : t.oppFgm;
  const fga = side === "offense" ? t.fga : t.oppFga;
  const fg3m = side === "offense" ? t.fg3m : t.oppFg3m;
  const fg3a = side === "offense" ? t.fg3a : t.oppFg3a;
  const ftm = side === "offense" ? t.ftm : t.oppFtm;
  const fta = side === "offense" ? t.fta : t.oppFta;
  const orb = side === "offense" ? t.orb : t.oppOrb;
  const drb = side === "offense" ? t.drb : t.oppDrb;
  const stl = side === "offense" ? t.stl : t.oppStl;
  const blk = side === "offense" ? t.blk : t.oppBlk;
  const tov = side === "offense" ? t.tov : t.oppTov;
  const pf = side === "offense" ? t.pf : t.oppPf;

  const twoM = fgm - fg3m;
  const twoA = fga - fg3a;

  return {
    alias: t.alias,
    fgPct: fgm / fga,
    threeP: per100(fg3m, t.poss),
    threePA: per100(fg3a, t.poss),
    threePct: fg3m / fg3a,
    twoP: per100(twoM, t.poss),
    twoPA: per100(twoA, t.poss),
    twoPct: twoM / twoA,
    ft: per100(ftm, t.poss),
    fta: per100(fta, t.poss),
    ftPct: ftm / fta,
    orb: per100(orb, t.poss),
    drb: per100(drb, t.poss),
    stl: per100(stl, t.poss),
    blk: per100(blk, t.poss),
    tov: per100(tov, t.poss),
    pf: per100(pf, t.poss),
  };
}

type StatKey = Exclude<keyof TeamDerivedPer100, "alias">;
const STAT_KEYS: StatKey[] = [
  "fgPct", "threeP", "threePA", "threePct", "twoP", "twoPA", "twoPct",
  "ft", "fta", "ftPct", "orb", "drb", "stl", "blk", "tov", "pf",
];

// Offense ranking: bigger is better for every stat here EXCEPT a
// team's own turnovers and fouls, where fewer is the good outcome.
const OFFENSE_LOWER_IS_BETTER = new Set<StatKey>(["tov", "pf"]);
// Defense/"Allowed" ranking: smaller is better for every stat here
// (less shooting/rebounding/ballhandling production allowed = better
// defense) EXCEPT the opponent's own turnovers -- MORE turnovers
// forced is good defense, the one stat where this flips.
const DEFENSE_LOWER_IS_BETTER = new Set<StatKey>(STAT_KEYS.filter((k) => k !== "tov"));

function rankTeams(teams: TeamDerivedPer100[], lowerIsBetter: Set<StatKey>): Map<string, TeamPer100Stats> {
  const ranksByTeam = new Map<string, Partial<Record<StatKey, StatWithRank>>>();
  for (const key of STAT_KEYS) {
    const ranked = rankWithTies(teams, (t) => t[key], lowerIsBetter.has(key));
    for (const [alias, stat] of ranked) {
      const entry = ranksByTeam.get(alias) ?? {};
      entry[key] = stat;
      ranksByTeam.set(alias, entry);
    }
  }
  const result = new Map<string, TeamPer100Stats>();
  for (const team of teams) {
    const r = ranksByTeam.get(team.alias)!;
    result.set(team.alias, {
      fgPct: r.fgPct!, threeP: r.threeP!, threePA: r.threePA!, threePct: r.threePct!,
      twoP: r.twoP!, twoPA: r.twoPA!, twoPct: r.twoPct!,
      ft: r.ft!, fta: r.fta!, ftPct: r.ftPct!,
      orb: r.orb!, drb: r.drb!,
      stl: r.stl!, blk: r.blk!, tov: r.tov!, pf: r.pf!,
    });
  }
  return result;
}

export async function getGameEfficiencyScoring(
  season: number,
  gameDate: Date,
  homeTeam: string,
  awayTeam: string
): Promise<GameEfficiencyScoring | null> {
  const totals = await getLeagueTeamBoxTotals(season, gameDate);
  if (totals.length === 0) return null;

  const offenseRanked = rankTeams(totals.map((t) => deriveSide(t, "offense")), OFFENSE_LOWER_IS_BETTER);
  const defenseRanked = rankTeams(totals.map((t) => deriveSide(t, "defense")), DEFENSE_LOWER_IS_BETTER);

  const homeOffense = offenseRanked.get(homeTeam);
  const awayOffense = offenseRanked.get(awayTeam);
  const homeDefense = defenseRanked.get(homeTeam);
  const awayDefense = defenseRanked.get(awayTeam);
  if (!homeOffense || !awayOffense || !homeDefense || !awayDefense) return null;

  return { homeOffense, awayOffense, homeDefense, awayDefense, totalTeams: totals.length };
}
