import { ImageResponse } from "next/og";
import type { Parlay, ParlayLeg } from "@/lib/parlayHelper";
import { logoDataUri } from "./logoDataUri";

// Same canvas sizes as renderSpotlightCard.tsx, same reasoning: wide
// for Facebook/X/LinkedIn, square for Instagram's grid view.
export const parlayCardSize = { width: 1248, height: 990 };
export const parlayCardSizeSquare = { width: 1080, height: 1080 };

// Same literal-color approach as renderSpotlightCard.tsx -- Satori
// can't read CSS custom properties, so every var(--x) the live site
// uses is hand-copied here. Kept as its own copy (not imported from
// renderSpotlightCard.tsx) since these two files should be free to
// drift independently -- a parlay card and a game card are different
// content types that just happen to share a brand palette today.
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

interface ParlayTheme {
  outerPadding: number;
  titleFontSize: number;
  titleMarginBottom: number;
  ribbonFontSize: number;
  ribbonPadding: string;
  ribbonMarginBottom: number;
  cardPadding: number;
  headFontSize: number;
  headMarginBottom: number;
  legGap: number;
  legPadding: string;
  logoSize: number;
  playerFontSize: number;
  pickFontSize: number;
  probFontSize: number;
  statsMarginTop: number;
  statValueFontSize: number;
  statLabelFontSize: number;
  footerFontSize: number;
  footerMarginTop: number;
}

const WIDE_THEME: ParlayTheme = {
  outerPadding: 40,
  titleFontSize: 26,
  titleMarginBottom: 18,
  ribbonFontSize: 28,
  ribbonPadding: "16px 30px",
  ribbonMarginBottom: 20,
  cardPadding: 32,
  headFontSize: 24,
  headMarginBottom: 18,
  legGap: 16,
  legPadding: "16px 14px",
  logoSize: 56,
  playerFontSize: 28,
  pickFontSize: 22,
  probFontSize: 34,
  statsMarginTop: 22,
  statValueFontSize: 44,
  statLabelFontSize: 18,
  footerFontSize: 24,
  footerMarginTop: 20,
};

const SQUARE_THEME: ParlayTheme = {
  ...WIDE_THEME,
  outerPadding: 48,
  legGap: 14,
  statsMarginTop: 26,
};

// "Over 74.5 Rec Yds" / "Anytime TD" -- same wording as ParlayCard.tsx's
// parlayLegLabel, duplicated rather than imported since that one lives
// in a "use client" component file next/og's renderer can't pull in.
function legLabel(leg: ParlayLeg): string {
  const e = leg.entry;
  if (e.consensusStat === "Anytime TD") return "Anytime TD";
  return `${e.pickSide ?? ""} ${e.pickLine ?? ""} ${e.consensusStat}`.trim();
}

function formatOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

function formatPercent(p: number): string {
  return `${Math.round(p * 100)}%`;
}

function ParlayLegRow({ leg, logo, theme }: { leg: ParlayLeg; logo: string; theme: ParlayTheme }) {
  const e = leg.entry;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 18,
        padding: theme.legPadding,
        borderRadius: 14,
        background: "rgba(0, 255, 65, 0.05)",
        border: `1px solid ${COLORS.panelBorder}`,
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
        <div style={{ display: "flex", fontSize: theme.playerFontSize, fontWeight: 700, color: COLORS.text }}>
          {e.playerName}
        </div>
        <div style={{ display: "flex", fontSize: theme.pickFontSize, color: COLORS.textDim, marginTop: 4 }}>
          {legLabel(leg)}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
        <div style={{ display: "flex", fontSize: theme.probFontSize, fontWeight: 800, color: COLORS.green }}>
          {formatPercent(leg.probability)}
        </div>
        <div style={{ display: "flex", fontSize: theme.pickFontSize - 4, color: COLORS.textDim, marginTop: 2 }}>
          {formatOdds(leg.odds)}
        </div>
      </div>
    </div>
  );
}

function ParlayCardTree({
  parlay,
  logos,
  theme,
  urlCallout,
}: {
  parlay: Parlay;
  logos: string[];
  theme: ParlayTheme;
  // Same Meta-link-cap reasoning as renderSpotlightCard.tsx's own
  // urlCallout prop -- see that file's comment.
  urlCallout?: boolean;
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
        THIS WEEK&apos;S VALUE PARLAY
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
            fontSize: theme.headFontSize,
            fontWeight: 700,
            letterSpacing: 1,
            color: COLORS.previewTag,
            marginBottom: theme.headMarginBottom,
          }}
        >
          {parlay.legs.length}-LEG PARLAY
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: theme.legGap }}>
          {parlay.legs.map((leg, i) => (
            <ParlayLegRow key={`${leg.entry.playerName}-${leg.entry.consensusStat}`} leg={leg} logo={logos[i]} theme={theme} />
          ))}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-around",
            marginTop: theme.statsMarginTop,
            paddingTop: theme.statsMarginTop,
            borderTop: `1px solid ${COLORS.panelBorder}`,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ display: "flex", fontSize: theme.statValueFontSize, fontWeight: 800, color: COLORS.green }}>
              {formatPercent(parlay.probability)}
            </div>
            <div style={{ display: "flex", fontSize: theme.statLabelFontSize, color: COLORS.textDim, marginTop: 4 }}>
              chance to hit
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ display: "flex", fontSize: theme.statValueFontSize, fontWeight: 800, color: COLORS.text }}>
              ${parlay.decimalOdds.toFixed(2)}
            </div>
            <div style={{ display: "flex", fontSize: theme.statLabelFontSize, color: COLORS.textDim, marginTop: 4 }}>
              payout on a $1 bet
            </div>
          </div>
        </div>
      </div>

      {/* Not "100,000 Monte Carlo simulations" like renderSpotlightCard.tsx's
          footer -- that phrase specifically describes the game win-
          probability model, not the PFF-sourced player-prop ranking this
          card is built from. Accurate instead of reused for the sake of a
          consistent tagline. */}
      <div style={{ display: "flex", marginTop: theme.footerMarginTop, fontSize: theme.footerFontSize, color: COLORS.textDim }}>
        Model-ranked player props · matrixsports.net
      </div>

      {urlCallout && (
        <div style={{ display: "flex", marginTop: 12, fontSize: 40, fontWeight: 800, letterSpacing: 1, color: COLORS.green }}>
          MatrixSports.Net/Parlays
        </div>
      )}
    </div>
  );
}

async function legLogos(parlay: Parlay): Promise<string[]> {
  return Promise.all(parlay.legs.map((leg) => logoDataUri(leg.entry.playerTeam)));
}

export async function renderParlayCard(parlay: Parlay): Promise<ImageResponse> {
  const logos = await legLogos(parlay);
  return new ImageResponse(<ParlayCardTree parlay={parlay} logos={logos} theme={WIDE_THEME} />, parlayCardSize);
}

export async function renderParlayCardFacebook(parlay: Parlay): Promise<ImageResponse> {
  const logos = await legLogos(parlay);
  return new ImageResponse(<ParlayCardTree parlay={parlay} logos={logos} theme={WIDE_THEME} urlCallout />, parlayCardSize);
}

export async function renderParlayCardSquare(parlay: Parlay): Promise<ImageResponse> {
  const logos = await legLogos(parlay);
  return new ImageResponse(<ParlayCardTree parlay={parlay} logos={logos} theme={SQUARE_THEME} />, parlayCardSizeSquare);
}
