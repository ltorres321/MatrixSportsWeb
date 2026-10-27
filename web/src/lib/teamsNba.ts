// NBA equivalent of teams.ts -- same alias/market/name shape, same
// teamLogoPath()/teamByAlias() convention, kept as a SEPARATE file
// rather than merged into teams.ts (NFL's TEAMS array) since the two
// sports' alias codes aren't guaranteed collision-free (NFL has no
// overlap today, but keeping them in one array would make that an
// implicit invariant nothing enforces). Aliases match hoopR's own
// team_abbreviation column (src4's data source) exactly, confirmed
// against data/raw/hoopr/team_box -- not ESPN's or any other
// provider's abbreviation scheme, which can differ slightly (e.g. "GS"
// not "GSW").
export const NBA_TEAMS = [
  { alias: "ATL", name: "Hawks", market: "Atlanta" },
  { alias: "BOS", name: "Celtics", market: "Boston" },
  { alias: "BKN", name: "Nets", market: "Brooklyn" },
  { alias: "CHA", name: "Hornets", market: "Charlotte" },
  { alias: "CHI", name: "Bulls", market: "Chicago" },
  { alias: "CLE", name: "Cavaliers", market: "Cleveland" },
  { alias: "DAL", name: "Mavericks", market: "Dallas" },
  { alias: "DEN", name: "Nuggets", market: "Denver" },
  { alias: "DET", name: "Pistons", market: "Detroit" },
  { alias: "GS", name: "Warriors", market: "Golden State" },
  { alias: "HOU", name: "Rockets", market: "Houston" },
  { alias: "IND", name: "Pacers", market: "Indiana" },
  { alias: "LAC", name: "Clippers", market: "LA" },
  { alias: "LAL", name: "Lakers", market: "Los Angeles" },
  { alias: "MEM", name: "Grizzlies", market: "Memphis" },
  { alias: "MIA", name: "Heat", market: "Miami" },
  { alias: "MIL", name: "Bucks", market: "Milwaukee" },
  { alias: "MIN", name: "Timberwolves", market: "Minnesota" },
  { alias: "NO", name: "Pelicans", market: "New Orleans" },
  { alias: "NY", name: "Knicks", market: "New York" },
  { alias: "OKC", name: "Thunder", market: "Oklahoma City" },
  { alias: "ORL", name: "Magic", market: "Orlando" },
  { alias: "PHI", name: "76ers", market: "Philadelphia" },
  { alias: "PHX", name: "Suns", market: "Phoenix" },
  { alias: "POR", name: "Trail Blazers", market: "Portland" },
  { alias: "SAC", name: "Kings", market: "Sacramento" },
  { alias: "SA", name: "Spurs", market: "San Antonio" },
  { alias: "TOR", name: "Raptors", market: "Toronto" },
  { alias: "UTAH", name: "Jazz", market: "Utah" },
  { alias: "WSH", name: "Wizards", market: "Washington" },
] as const;

// Downloaded from TheSportsDB (thesportsdb.com/league/4387-nba) and
// converted to 160x160 WebP the same way teams.ts's own comment
// describes for the NFL set -- see that file for the sizing rationale.
export function teamLogoPath(alias: string) {
  return `/assets/team-logos/nba/${alias}.webp`;
}

export function teamByAlias(alias: string) {
  return NBA_TEAMS.find((t) => t.alias === alias);
}
