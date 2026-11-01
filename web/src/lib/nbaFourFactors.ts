import "server-only";
import { getLeagueTeamBoxTotals, rankWithTies, type TeamBoxTotals } from "@/lib/nbaTeamBoxTotals";

// Dean Oliver's Four Factors, computed league-wide from the exact same
// per-team season totals nbaEfficiencyScoring.ts/nbaTeamGrades.ts
// already share (see nbaTeamBoxTotals.ts's own header) -- no new
// ingestion, just textbook Four Factors ratios applied to fields that
// file already sums per team (eFG%/FT Rate/ORB%/DRB%/TOV% aren't
// computed there, since that card shows raw per-100 counts, not these
// ratios). Feeds the Radar Chart view in NbaLineupSection.tsx, which
// replaced the old shot-chart mode there -- unlike that mode, this is
// built entirely from season-to-date team stats, so it works pregame.
//
// Percentile, not raw rank -- a radar's shape is only honest when
// every axis is on the same 0-100 scale (eFG% sits near 55, FT Rate
// near 0.25 -- unusable together as raw numbers plotted directly).
// Every axis is oriented so bigger percentile = better, including the
// defense ("allowed") side (opponent eFG%, opponent FT rate are both
// inverted -- lower allowed is better defense) and the one stat that
// flips direction from its own name on defense: forcing MORE opponent
// turnovers is good defense, not bad.

export interface FourFactorValue {
  value: number; // raw rate -- a 0-1 ratio for every factor here
  percentile: number; // 0-100, already direction-adjusted: higher always plots outward as "better"
}

export interface TeamFourFactors {
  offense: {
    efgPct: FourFactorValue;
    orbPct: FourFactorValue;
    ftRate: FourFactorValue;
    tovPct: FourFactorValue;
  };
  defense: {
    oppEfgPct: FourFactorValue;
    drbPct: FourFactorValue;
    oppFtRate: FourFactorValue;
    forcedTovPct: FourFactorValue;
  };
  offRtg: number;
  defRtg: number;
  netRtg: number;
  // Dean Oliver's per-game possession estimate, same field
  // nbaTeamBoxTotals.ts's own header notes isn't normalized to a
  // strict 48-minute game (team_box_scores has no minutes column) --
  // a reasonable pace proxy, not an exact per-48 figure.
  pace: number;
}

export interface GameFourFactors {
  home: TeamFourFactors;
  away: TeamFourFactors;
  totalTeams: number;
}

interface TeamDerived {
  alias: string;
  efgPct: number;
  orbPct: number;
  ftRate: number;
  tovPct: number;
  oppEfgPct: number;
  drbPct: number;
  oppFtRate: number;
  forcedTovPct: number;
  offRtg: number;
  defRtg: number;
  pace: number;
}

// 0.4 (not the more commonly quoted 0.44) to match the exact
// coefficient nbaTeamBoxTotals.ts's own possession estimate already
// uses for FTA's playmaking weight -- keeps this file's TOV%/forced
// TOV% consistent with the one possession formula this whole page
// already depends on, rather than introducing a second constant.
const FTA_WEIGHT = 0.4;

function derive(t: TeamBoxTotals): TeamDerived {
  const efgPct = (t.fgm + 0.5 * t.fg3m) / t.fga;
  const orbPct = t.orb / (t.orb + t.oppDrb);
  const ftRate = t.fta / t.fga;
  const tovPct = t.tov / (t.fga + FTA_WEIGHT * t.fta + t.tov);
  const oppEfgPct = (t.oppFgm + 0.5 * t.oppFg3m) / t.oppFga;
  const drbPct = t.drb / (t.drb + t.oppOrb);
  const oppFtRate = t.oppFta / t.oppFga;
  const forcedTovPct = t.oppTov / (t.oppFga + FTA_WEIGHT * t.oppFta + t.oppTov);
  return {
    alias: t.alias,
    efgPct, orbPct, ftRate, tovPct,
    oppEfgPct, drbPct, oppFtRate, forcedTovPct,
    offRtg: (t.pts / t.poss) * 100,
    defRtg: (t.oppPts / t.poss) * 100,
    pace: t.poss,
  };
}

type FactorKey = "efgPct" | "orbPct" | "ftRate" | "tovPct" | "oppEfgPct" | "drbPct" | "oppFtRate" | "forcedTovPct";
const FACTOR_KEYS: FactorKey[] = ["efgPct", "orbPct", "ftRate", "tovPct", "oppEfgPct", "drbPct", "oppFtRate", "forcedTovPct"];

// Only a team's own turnovers and what it allows on defense (opponent
// shooting, opponent FT rate) run backwards from "bigger raw number is
// better" -- everything else here, including defensive rebound % and
// forced turnover %, is already a "more is better" stat by its own
// definition.
const LOWER_IS_BETTER = new Set<FactorKey>(["tovPct", "oppEfgPct", "oppFtRate"]);

function percentileFromRank(rank: number, totalTeams: number): number {
  if (totalTeams <= 1) return 50;
  return (100 * (totalTeams - rank)) / (totalTeams - 1);
}

function rankTeams(teams: TeamDerived[]): Map<string, Record<FactorKey, FourFactorValue>> {
  const byTeam = new Map<string, Partial<Record<FactorKey, FourFactorValue>>>();
  for (const key of FACTOR_KEYS) {
    const ranked = rankWithTies(teams, (t) => t[key], LOWER_IS_BETTER.has(key));
    for (const [alias, stat] of ranked) {
      const entry = byTeam.get(alias) ?? {};
      entry[key] = { value: stat.value, percentile: percentileFromRank(stat.rank, teams.length) };
      byTeam.set(alias, entry);
    }
  }
  const result = new Map<string, Record<FactorKey, FourFactorValue>>();
  for (const team of teams) {
    const r = byTeam.get(team.alias)!;
    result.set(team.alias, {
      efgPct: r.efgPct!, orbPct: r.orbPct!, ftRate: r.ftRate!, tovPct: r.tovPct!,
      oppEfgPct: r.oppEfgPct!, drbPct: r.drbPct!, oppFtRate: r.oppFtRate!, forcedTovPct: r.forcedTovPct!,
    });
  }
  return result;
}

export async function getGameFourFactors(
  season: number,
  gameDate: Date,
  homeTeam: string,
  awayTeam: string
): Promise<GameFourFactors | null> {
  const totals = await getLeagueTeamBoxTotals(season, gameDate);
  if (totals.length === 0) return null;

  const derived = totals.map(derive);
  const derivedByAlias = new Map(derived.map((d) => [d.alias, d]));
  const ranked = rankTeams(derived);

  function build(alias: string): TeamFourFactors | null {
    const r = ranked.get(alias);
    const d = derivedByAlias.get(alias);
    if (!r || !d) return null;
    return {
      offense: { efgPct: r.efgPct, orbPct: r.orbPct, ftRate: r.ftRate, tovPct: r.tovPct },
      defense: { oppEfgPct: r.oppEfgPct, drbPct: r.drbPct, oppFtRate: r.oppFtRate, forcedTovPct: r.forcedTovPct },
      offRtg: d.offRtg,
      defRtg: d.defRtg,
      netRtg: d.offRtg - d.defRtg,
      pace: d.pace,
    };
  }

  const home = build(homeTeam);
  const away = build(awayTeam);
  if (!home || !away) return null;

  return { home, away, totalTeams: totals.length };
}
