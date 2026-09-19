import { ImageResponse } from "next/og";
import type { WeekRecord } from "./weeklyStats";

export const socialCardSize = { width: 1080, height: 1350 };

const COLORS = {
  bg: "#030603",
  panel: "rgba(4, 20, 8, 0.85)",
  panelBorder: "rgba(0, 255, 65, 0.28)",
  green: "#00ff41",
  textDim: "#6fae83",
  text: "#eafff2",
};

// Single week's record only, not season-to-date -- matches what was
// asked ("post win/loss records on Tuesday" about the weekend just
// played). Season-to-date would need summing every prior week's
// getMatchupsForSeasonWeek() call, which is a fine follow-up if
// wanted, just not built here yet.
export async function renderRecapCard(
  season: number,
  week: number,
  record: WeekRecord
): Promise<ImageResponse> {
  const wrong = record.total - record.correct;
  const pct = record.total > 0 ? Math.round((record.correct / record.total) * 100) : 0;

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
            padding: "60px 40px",
          }}
        >
          <div style={{ display: "flex", fontSize: 28, letterSpacing: 4, color: COLORS.textDim }}>
            {season} SEASON · WEEK {week} MODEL RECORD
          </div>

          <div style={{ display: "flex", fontSize: 220, fontWeight: 800, color: COLORS.green, marginTop: 30 }}>
            {record.correct}-{wrong}
          </div>

          <div style={{ display: "flex", fontSize: 34, color: COLORS.text, marginTop: 10 }}>
            {pct}% of graded picks called correctly
          </div>
        </div>

        <div style={{ display: "flex", marginTop: 40, fontSize: 22, color: COLORS.textDim }}>
          100,000 Monte Carlo simulations · matrixsports.net
        </div>
      </div>
    ),
    socialCardSize
  );
}
