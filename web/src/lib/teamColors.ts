// Primary brand color per team -- public, well-known team branding
// (not licensed imagery), used only as a subtle accent glow behind
// each team's logo on the generated matchup card (pickCardImage.tsx),
// not as a dominant background, so the card still reads as this
// site's own Matrix-green identity first.
export const TEAM_PRIMARY_COLOR: Record<string, string> = {
  ARI: "#97233F",
  ATL: "#A71930",
  BAL: "#241773",
  BUF: "#00338D",
  CAR: "#0085CA",
  CHI: "#0B162A",
  CIN: "#FB4F14",
  CLE: "#FF3C00",
  DAL: "#041E42",
  DEN: "#FB4F14",
  DET: "#0076B6",
  GB: "#203731",
  HOU: "#03202F",
  IND: "#002C5F",
  JAX: "#006778",
  KC: "#E31837",
  LAC: "#0080C6",
  LAR: "#003594",
  LV: "#A5ACAF",
  MIA: "#008E97",
  MIN: "#4F2683",
  NE: "#002244",
  NO: "#D3BC8D",
  NYG: "#0B2265",
  NYJ: "#125740",
  PHI: "#004C54",
  PIT: "#FFB612",
  SEA: "#69BE28",
  SF: "#AA0000",
  TB: "#D50A0A",
  TEN: "#4B92DB",
  WAS: "#5A1414",
};

export function teamPrimaryColor(alias: string): string {
  return TEAM_PRIMARY_COLOR[alias] ?? "#00ff41";
}
