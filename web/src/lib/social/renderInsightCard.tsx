import { ImageResponse } from "next/og";
import { teamByAlias } from "@/lib/teams";
import type { WeeklyInsight } from "./weeklyStats";
import { logoDataUri } from "./logoDataUri";

export const socialCardSize = { width: 1080, height: 1350 };

const COLORS = {
  bg: "#030603",
  panel: "rgba(4, 20, 8, 0.85)",
  panelBorder: "rgba(0, 255, 65, 0.28)",
  green: "#00ff41",
  textDim: "#6fae83",
  text: "#eafff2",
};

function teamDisplay(alias: string): string {
  const team = teamByAlias(alias);
  return team ? `${team.market} ${team.name}` : alias;
}

function Headline({ insight }: { insight: WeeklyInsight }) {
  return (
    <div style={{ display: "flex", fontSize: 28, letterSpacing: 4, color: COLORS.textDim }}>
      {insight.kind === "bestPick" ? "MODEL'S BEST CALL OF THE WEEK" : "CLOSEST GAME OF THE WEEK"}
    </div>
  );
}

function Detail({ insight }: { insight: WeeklyInsight }) {
  if (insight.kind === "bestPick") {
    return (
      <div style={{ display: "flex", fontSize: 30, color: COLORS.text, marginTop: 14 }}>
        Called at {insight.winProb}% before kickoff — and nailed it.
      </div>
    );
  }
  return (
    <div style={{ display: "flex", fontSize: 30, color: COLORS.text, marginTop: 14 }}>
      Decided by just {insight.margin} point{insight.margin === 1 ? "" : "s"}.
    </div>
  );
}

export async function renderInsightCard(insight: WeeklyInsight): Promise<ImageResponse> {
  const { matchup } = insight;
  const [logoA, logoB] = await Promise.all([
    logoDataUri(matchup.teamA.alias),
    logoDataUri(matchup.teamB.alias),
  ]);

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
          padding: 60,
        }}
      >
        <div style={{ display: "flex", fontSize: 30, letterSpacing: 10, fontWeight: 700, color: COLORS.green, marginBottom: 36 }}>
          MATRIX SPORTS ANALYTICS
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "100%",
            background: COLORS.panel,
            border: `1px solid ${COLORS.panelBorder}`,
            borderRadius: 24,
            padding: "50px 40px",
          }}
        >
          <Headline insight={insight} />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 40, gap: 50 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoA} width={140} height={140} alt="" style={{ borderRadius: 999 }} />
              <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: COLORS.text, marginTop: 16, textAlign: "center" }}>
                {teamDisplay(matchup.teamA.alias)}
              </div>
              <div style={{ display: "flex", fontSize: 50, fontWeight: 800, color: COLORS.green, marginTop: 8 }}>
                {matchup.teamA.score}
              </div>
            </div>

            <div style={{ display: "flex", fontSize: 30, color: COLORS.textDim }}>@</div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoB} width={140} height={140} alt="" style={{ borderRadius: 999 }} />
              <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: COLORS.text, marginTop: 16, textAlign: "center" }}>
                {teamDisplay(matchup.teamB.alias)}
              </div>
              <div style={{ display: "flex", fontSize: 50, fontWeight: 800, color: COLORS.green, marginTop: 8 }}>
                {matchup.teamB.score}
              </div>
            </div>
          </div>

          <Detail insight={insight} />
        </div>

        <div style={{ display: "flex", marginTop: 40, fontSize: 22, color: COLORS.textDim }}>
          100,000 Monte Carlo simulations · matrixsports.net
        </div>
      </div>
    ),
    socialCardSize
  );
}
