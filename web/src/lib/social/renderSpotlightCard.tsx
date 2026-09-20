import { ImageResponse } from "next/og";
import { teamByAlias } from "@/lib/teams";
import type { Matchup, TeamSide } from "@/lib/matchups";
import { logoDataUri } from "./logoDataUri";

// 1248x990 matches the live homepage MatchupCard's own screenshot
// proportions -- used for Facebook/X/LinkedIn. Instagram gets its own
// 1080x1080 square render (see renderSpotlightCardSquare below): that
// landscape shape gets center-cropped to a square in Instagram's grid
// view, clipping the logo/percentage that sit near the left/right
// edges -- a real 1:1 render avoids that instead of relying on
// Instagram's own crop.
export const socialCardSize = { width: 1248, height: 990 };
export const socialCardSizeSquare = { width: 1080, height: 1080 };

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

// Every size/spacing number that differs between the wide (FB/X/
// LinkedIn) and square (Instagram) renders -- tuned by eye per
// canvas, not a clean formula, since legibility at "whole image
// shrunk to fit a phone screen" size doesn't scale linearly with
// canvas dimensions.
interface SpotlightTheme {
  outerPadding: number;
  titleFontSize: number;
  titleMarginBottom: number;
  ribbonFontSize: number;
  ribbonPadding: string;
  ribbonMarginBottom: number;
  cardPadding: number;
  statusMarginBottom: number;
  tagFontSize: number;
  tagPadding: string;
  kickoffFontSize: number;
  rowGap: number;
  rowPadding: string;
  logoSize: number;
  nameFontSize: number;
  recordFontSize: number;
  rightColWidth: number;
  probFontSize: number;
  barWidth: number;
  barHeight: number;
  vsFontSize: number;
  footerFontSize: number;
  footerMarginTop: number;
}

const WIDE_THEME: SpotlightTheme = {
  outerPadding: 40,
  titleFontSize: 26,
  titleMarginBottom: 18,
  ribbonFontSize: 30,
  ribbonPadding: "16px 30px",
  ribbonMarginBottom: 20,
  cardPadding: 32,
  statusMarginBottom: 14,
  tagFontSize: 26,
  tagPadding: "10px 20px",
  kickoffFontSize: 30,
  rowGap: 24,
  rowPadding: "14px 12px",
  logoSize: 96,
  nameFontSize: 48,
  recordFontSize: 26,
  rightColWidth: 230,
  probFontSize: 68,
  barWidth: 210,
  barHeight: 12,
  vsFontSize: 24,
  footerFontSize: 24,
  footerMarginTop: 20,
};

const SQUARE_THEME: SpotlightTheme = {
  ...WIDE_THEME,
  outerPadding: 48,
  rightColWidth: 200,
  barWidth: 180,
  footerMarginTop: 32,
};

function TeamRow({ side, logo, theme }: { side: TeamSide; logo: string; theme: SpotlightTheme }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: theme.rowGap,
        padding: theme.rowPadding,
        borderRadius: 14,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logo}
        width={theme.logoSize}
        height={theme.logoSize}
        alt=""
        style={{ borderRadius: 999, border: `2px solid ${COLORS.panelBorder}` }}
      />
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ display: "flex", fontSize: theme.nameFontSize, fontWeight: 700, color: COLORS.text }}>
          {teamDisplay(side.alias)}
        </div>
        <div style={{ display: "flex", fontSize: theme.recordFontSize, color: COLORS.textDim, marginTop: 6 }}>
          {side.record}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", width: theme.rightColWidth }}>
        <div style={{ display: "flex", fontSize: theme.probFontSize, fontWeight: 800, color: COLORS.green }}>
          {side.prob !== undefined ? `${side.prob}%` : "—"}
        </div>
        {side.prob !== undefined && (
          <div
            style={{
              display: "flex",
              width: theme.barWidth,
              height: theme.barHeight,
              borderRadius: theme.barHeight / 2,
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

function SpotlightCardTree({
  matchup,
  logoA,
  logoB,
  ribbonText,
  theme,
}: {
  matchup: Matchup;
  logoA: string;
  logoB: string;
  ribbonText: string;
  theme: SpotlightTheme;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: `radial-gradient(circle at 50% 30%, #052210 0%, ${COLORS.bg} 70%)`,
        padding: theme.outerPadding,
      }}
    >
      <div style={{ display: "flex", fontSize: theme.titleFontSize, letterSpacing: 6, fontWeight: 700, color: COLORS.green, marginBottom: theme.titleMarginBottom }}>
        MATRIX SPORTS ANALYTICS
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          fontSize: theme.ribbonFontSize,
          fontWeight: 700,
          letterSpacing: 1,
          color: COLORS.green,
          background: COLORS.greenFaint,
          border: `1px solid ${COLORS.panelBorder}`,
          borderRadius: 999,
          padding: theme.ribbonPadding,
          marginBottom: theme.ribbonMarginBottom,
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
          padding: theme.cardPadding,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: theme.statusMarginBottom,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: theme.tagFontSize,
              fontWeight: 700,
              letterSpacing: 1,
              color: COLORS.previewTag,
              border: `1px solid rgba(127, 209, 255, 0.4)`,
              borderRadius: 6,
              padding: theme.tagPadding,
            }}
          >
            UPCOMING
          </div>
          <div style={{ display: "flex", fontSize: theme.kickoffFontSize, color: COLORS.textDim }}>
            {matchup.kickoff}
          </div>
        </div>

        <TeamRow side={matchup.teamA} logo={logoA} theme={theme} />
        <div style={{ display: "flex", justifyContent: "center", fontSize: theme.vsFontSize, letterSpacing: 4, color: COLORS.textDim, margin: "2px 0" }}>
          VS
        </div>
        <TeamRow side={matchup.teamB} logo={logoB} theme={theme} />
      </div>

      <div style={{ display: "flex", marginTop: theme.footerMarginTop, fontSize: theme.footerFontSize, color: COLORS.textDim }}>
        100,000 Monte Carlo simulations · matrixsports.net
      </div>
    </div>
  );
}

// No "★" glyph -- Satori's default font (no custom font is loaded,
// same as pickCardImage.tsx) doesn't cover that character and renders
// it as a broken tofu box. The diamond div in SpotlightCardTree stands
// in for it instead of relying on font glyph coverage.
function ribbonTextFor(matchup: Matchup): string {
  return `FREE ${matchup.premierLabel ?? "GAME OF THE WEEK"} — FREE PREVIEW`;
}

export async function renderSpotlightCard(matchup: Matchup): Promise<ImageResponse> {
  const [logoA, logoB] = await Promise.all([
    logoDataUri(matchup.teamA.alias),
    logoDataUri(matchup.teamB.alias),
  ]);

  return new ImageResponse(
    (
      <SpotlightCardTree
        matchup={matchup}
        logoA={logoA}
        logoB={logoB}
        ribbonText={ribbonTextFor(matchup)}
        theme={WIDE_THEME}
      />
    ),
    socialCardSize
  );
}

// Instagram-specific 1:1 render -- see socialCardSizeSquare's comment.
export async function renderSpotlightCardSquare(matchup: Matchup): Promise<ImageResponse> {
  const [logoA, logoB] = await Promise.all([
    logoDataUri(matchup.teamA.alias),
    logoDataUri(matchup.teamB.alias),
  ]);

  return new ImageResponse(
    (
      <SpotlightCardTree
        matchup={matchup}
        logoA={logoA}
        logoB={logoB}
        ribbonText={ribbonTextFor(matchup)}
        theme={SQUARE_THEME}
      />
    ),
    socialCardSizeSquare
  );
}
