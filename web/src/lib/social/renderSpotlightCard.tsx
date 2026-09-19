import { ImageResponse } from "next/og";
import { teamByAlias } from "@/lib/teams";
import type { Matchup, TeamSide } from "@/lib/matchups";
import { logoDataUri } from "./logoDataUri";

// Matches the live homepage MatchupCard's own screenshot proportions
// (1248x990) -- the earlier 4:5 portrait (1080x1350) read as too
// tall/empty for how little content there is. Still well within
// Instagram's supported feed range (4:5 to 1.91:1).
export const socialCardSize = { width: 1248, height: 990 };

function teamDisplay(alias: string): string {
  const team = teamByAlias(alias);
  return team ? `${team.market} ${team.name}` : alias;
}

// Same values as the live .team-row/.prob-bar/.tag CSS in
// globals.css, translated to literal colors -- Satori (the renderer
// behind next/og's ImageResponse) can't read CSS custom properties,
// so every var(--x) the real site uses has to be hand-copied here.
const COLORS = {
  bg: "#030603",
  panel: "rgba(4, 20, 8, 0.85)",
  panelBorder: "rgba(0, 255, 65, 0.28)",
  green: "#00ff41",
  greenFaint: "rgba(0, 255, 65, 0.12)",
  textDim: "#6fae83",
  text: "#eafff2",
  previewTag: "#7fd1ff",
};

function TeamRow({ side, logo }: { side: TeamSide; logo: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 28,
        padding: "18px 16px",
        borderRadius: 14,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logo}
        width={90}
        height={90}
        alt=""
        style={{ borderRadius: 999, border: `2px solid ${COLORS.panelBorder}` }}
      />
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ display: "flex", fontSize: 36, fontWeight: 700, color: COLORS.text }}>
          {teamDisplay(side.alias)}
        </div>
        <div style={{ display: "flex", fontSize: 22, color: COLORS.textDim, marginTop: 4 }}>
          {side.record}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", width: 220 }}>
        <div style={{ display: "flex", fontSize: 48, fontWeight: 800, color: COLORS.green }}>
          {side.prob !== undefined ? `${side.prob}%` : "—"}
        </div>
        {side.prob !== undefined && (
          <div
            style={{
              display: "flex",
              width: 200,
              height: 10,
              borderRadius: 5,
              background: "rgba(0, 255, 65, 0.15)",
              marginTop: 10,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                width: `${side.prob}%`,
                height: "100%",
                background: COLORS.green,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export async function renderSpotlightCard(matchup: Matchup): Promise<ImageResponse> {
  const [logoA, logoB] = await Promise.all([
    logoDataUri(matchup.teamA.alias),
    logoDataUri(matchup.teamB.alias),
  ]);
  // No "★" glyph here -- Satori's default font (no custom font is
  // loaded, same as pickCardImage.tsx) doesn't cover that character
  // and renders it as a broken tofu box. The diamond div below stands
  // in for it instead of relying on font glyph coverage.
  const ribbonText = `FREE ${matchup.premierLabel ?? "GAME OF THE WEEK"} — FREE PREVIEW`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: `radial-gradient(circle at 50% 30%, #052210 0%, ${COLORS.bg} 70%)`,
          padding: 48,
        }}
      >
        <div style={{ display: "flex", fontSize: 30, letterSpacing: 10, fontWeight: 700, color: COLORS.green, marginBottom: 26 }}>
          MATRIX SPORTS ANALYTICS
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: 2,
            color: COLORS.green,
            background: COLORS.greenFaint,
            border: `1px solid ${COLORS.panelBorder}`,
            borderRadius: 999,
            padding: "14px 32px",
            marginBottom: 28,
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              width: 14,
              height: 14,
              background: COLORS.green,
              transform: "rotate(45deg)",
              marginRight: 16,
            }}
          />
          {ribbonText}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            background: COLORS.panel,
            border: `1px solid ${COLORS.panelBorder}`,
            borderRadius: 24,
            padding: 40,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: 2,
                color: COLORS.previewTag,
                border: `1px solid rgba(127, 209, 255, 0.4)`,
                borderRadius: 6,
                padding: "8px 18px",
              }}
            >
              UPCOMING
            </div>
            <div style={{ display: "flex", fontSize: 24, color: COLORS.textDim }}>
              {matchup.kickoff}
            </div>
          </div>

          <TeamRow side={matchup.teamA} logo={logoA} />
          <div style={{ display: "flex", justifyContent: "center", fontSize: 20, letterSpacing: 6, color: COLORS.textDim, margin: "4px 0" }}>
            VS
          </div>
          <TeamRow side={matchup.teamB} logo={logoB} />
        </div>

        <div style={{ display: "flex", marginTop: 26, fontSize: 22, color: COLORS.textDim }}>
          100,000 Monte Carlo simulations · matrixsports.net
        </div>
      </div>
    ),
    socialCardSize
  );
}
