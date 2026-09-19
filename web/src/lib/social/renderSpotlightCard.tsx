import { ImageResponse } from "next/og";
import { teamByAlias } from "@/lib/teams";
import type { Matchup, TeamSide } from "@/lib/matchups";
import { logoDataUri } from "./logoDataUri";

// 4:5 (portrait), not the 1200x630 landscape used by the link-preview
// OG image -- this is sized for the feed post itself (Instagram in
// particular crops landscape images badly in-feed), not for a link
// unfurl card. Works fine un-cropped on Facebook/X/LinkedIn too.
export const socialCardSize = { width: 1080, height: 1350 };

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
        gap: 32,
        padding: "30px 16px",
        borderRadius: 14,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logo}
        width={110}
        height={110}
        alt=""
        style={{ borderRadius: 999, border: `2px solid ${COLORS.panelBorder}` }}
      />
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ display: "flex", fontSize: 42, fontWeight: 700, color: COLORS.text }}>
          {teamDisplay(side.alias)}
        </div>
        <div style={{ display: "flex", fontSize: 26, color: COLORS.textDim, marginTop: 6 }}>
          {side.record}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", width: 240 }}>
        <div style={{ display: "flex", fontSize: 56, fontWeight: 800, color: COLORS.green }}>
          {side.prob !== undefined ? `${side.prob}%` : "—"}
        </div>
        {side.prob !== undefined && (
          <div
            style={{
              display: "flex",
              width: 220,
              height: 12,
              borderRadius: 6,
              background: "rgba(0, 255, 65, 0.15)",
              marginTop: 12,
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
          padding: 70,
        }}
      >
        <div style={{ display: "flex", fontSize: 36, letterSpacing: 12, fontWeight: 700, color: COLORS.green, marginBottom: 50 }}>
          MATRIX SPORTS ANALYTICS
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 27,
            fontWeight: 700,
            letterSpacing: 3,
            color: COLORS.green,
            background: COLORS.greenFaint,
            border: `1px solid ${COLORS.panelBorder}`,
            borderRadius: 999,
            padding: "18px 40px",
            marginBottom: 56,
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              width: 16,
              height: 16,
              background: COLORS.green,
              transform: "rotate(45deg)",
              marginRight: 18,
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
            padding: 56,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 28,
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: 2,
                color: COLORS.previewTag,
                border: `1px solid rgba(127, 209, 255, 0.4)`,
                borderRadius: 6,
                padding: "10px 22px",
              }}
            >
              UPCOMING
            </div>
            <div style={{ display: "flex", fontSize: 28, color: COLORS.textDim }}>
              {matchup.kickoff}
            </div>
          </div>

          <TeamRow side={matchup.teamA} logo={logoA} />
          <div style={{ display: "flex", justifyContent: "center", fontSize: 24, letterSpacing: 6, color: COLORS.textDim, margin: "10px 0" }}>
            VS
          </div>
          <TeamRow side={matchup.teamB} logo={logoB} />
        </div>

        <div style={{ display: "flex", marginTop: 56, fontSize: 26, color: COLORS.textDim }}>
          100,000 Monte Carlo simulations · matrixsports.net
        </div>
      </div>
    ),
    socialCardSize
  );
}
