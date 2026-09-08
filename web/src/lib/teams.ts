// Ported from static/teams.js. Keep the alias list in sync with
// sql/*.sql's TEAM_ALIASES-equivalent checks (currently only
// enforced app-side in signup/actions.ts).
export const TEAMS = [
  { alias: "ARI", name: "Cardinals", market: "Arizona" },
  { alias: "ATL", name: "Falcons", market: "Atlanta" },
  { alias: "BAL", name: "Ravens", market: "Baltimore" },
  { alias: "BUF", name: "Bills", market: "Buffalo" },
  { alias: "CAR", name: "Panthers", market: "Carolina" },
  { alias: "CHI", name: "Bears", market: "Chicago" },
  { alias: "CIN", name: "Bengals", market: "Cincinnati" },
  { alias: "CLE", name: "Browns", market: "Cleveland" },
  { alias: "DAL", name: "Cowboys", market: "Dallas" },
  { alias: "DEN", name: "Broncos", market: "Denver" },
  { alias: "DET", name: "Lions", market: "Detroit" },
  { alias: "GB", name: "Packers", market: "Green Bay" },
  { alias: "HOU", name: "Texans", market: "Houston" },
  { alias: "IND", name: "Colts", market: "Indianapolis" },
  { alias: "JAX", name: "Jaguars", market: "Jacksonville" },
  { alias: "KC", name: "Chiefs", market: "Kansas City" },
  { alias: "LAC", name: "Chargers", market: "Los Angeles" },
  { alias: "LAR", name: "Rams", market: "Los Angeles" },
  { alias: "LV", name: "Raiders", market: "Las Vegas" },
  { alias: "MIA", name: "Dolphins", market: "Miami" },
  { alias: "MIN", name: "Vikings", market: "Minnesota" },
  { alias: "NE", name: "Patriots", market: "New England" },
  { alias: "NO", name: "Saints", market: "New Orleans" },
  { alias: "NYG", name: "Giants", market: "New York" },
  { alias: "NYJ", name: "Jets", market: "New York" },
  { alias: "PHI", name: "Eagles", market: "Philadelphia" },
  { alias: "PIT", name: "Steelers", market: "Pittsburgh" },
  { alias: "SEA", name: "Seahawks", market: "Seattle" },
  { alias: "SF", name: "49ers", market: "San Francisco" },
  { alias: "TB", name: "Buccaneers", market: "Tampa Bay" },
  { alias: "TEN", name: "Titans", market: "Tennessee" },
  { alias: "WAS", name: "Commanders", market: "Washington" },
] as const;

export function teamLogoPath(alias: string) {
  return `/assets/team-logos/${alias}.png`;
}

export function teamByAlias(alias: string) {
  return TEAMS.find((t) => t.alias === alias);
}
