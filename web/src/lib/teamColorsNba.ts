// NBA equivalent of teamColors.ts -- same "public, well-known team
// branding, subtle accent only" rationale, keyed by this app's own
// NBA alias scheme (teamsNba.ts) rather than NFL's.
export const NBA_TEAM_PRIMARY_COLOR: Record<string, string> = {
  ATL: "#E03A3E",
  BOS: "#007A33",
  BKN: "#000000",
  CHA: "#1D1160",
  CHI: "#CE1141",
  CLE: "#860038",
  DAL: "#00538C",
  DEN: "#0E2240",
  DET: "#C8102E",
  GS: "#1D428A",
  HOU: "#CE1141",
  IND: "#002D62",
  LAC: "#C8102E",
  LAL: "#552583",
  MEM: "#5D76A9",
  MIA: "#98002E",
  MIL: "#00471B",
  MIN: "#0C2340",
  NO: "#0C2340",
  NY: "#006BB6",
  OKC: "#007AC1",
  ORL: "#0077C0",
  PHI: "#006BB6",
  PHX: "#1D1160",
  POR: "#E03A3E",
  SAC: "#5A2D81",
  SA: "#000000",
  TOR: "#CE1141",
  UTAH: "#002B5C",
  WSH: "#002B5C",
};

export function teamPrimaryColorNba(alias: string): string {
  return NBA_TEAM_PRIMARY_COLOR[alias] ?? "#00ff41";
}
