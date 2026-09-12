import { readFile } from "fs/promises";
import path from "path";
import { ImageResponse } from "next/og";
import { getGameDetail } from "@/lib/predictions";
import { teamByAlias } from "@/lib/teams";
import type { GameStat, GameStatSide } from "@/lib/gameStats";

// Shared by opengraph-image.tsx and twitter-image.tsx -- both are
// Next.js special-file conventions that need their own exports, but
// the actual rendering only needs to live once. Runs on the Node
// runtime (not Edge) specifically so team logos can be read straight
// off disk as base64 data URIs -- more reliable than an HTTP fetch
// back to the site's own domain from inside the image generator, and
// works identically on every deploy (production, branch previews)
// without needing to know that deploy's own origin.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function teamDisplay(alias: string): string {
  const team = teamByAlias(alias);
  return team ? `${team.market} ${team.name}` : alias;
}

async function logoDataUri(alias: string): Promise<string> {
  const filePath = path.join(process.cwd(), "public", "assets", "team-logos", `${alias}.png`);
  const buf = await readFile(filePath);
  return `data:image/png;base64,${buf.toString("base64")}`;
}

function TeamColumn({ side, logo, align }: { side: GameStatSide; logo: string; align: "left" | "right" }) {
  const showScore = side.score !== undefined;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: 340,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo} width={120} height={120} alt="" />
      <div
        style={{
          display: "flex",
          marginTop: 18,
          fontSize: 30,
          fontWeight: 700,
          color: "#f4fff9",
          textAlign: "center",
        }}
      >
        {teamDisplay(side.alias)}
      </div>
      <div
        style={{
          display: "flex",
          marginTop: 10,
          fontSize: 64,
          fontWeight: 700,
          color: showScore ? "#f4fff9" : "#26ff64",
        }}
      >
        {showScore ? side.score : `${side.winProb}%`}
      </div>
      {!showScore && (
        <div style={{ display: "flex", fontSize: 18, color: "#6fae83", marginTop: 4 }}>WIN PROBABILITY</div>
      )}
    </div>
  );
}

export async function renderPickCard(id: string): Promise<ImageResponse> {
  const game: GameStat | null = await getGameDetail(id);

  if (!game) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #001f0d 0%, #000a04 100%)",
            color: "#c8ffd4",
            fontSize: 40,
          }}
        >
          MATRIX SPORTS ANALYTICS
        </div>
      ),
      size
    );
  }

  const [logoA, logoB] = await Promise.all([logoDataUri(game.teamA.alias), logoDataUri(game.teamB.alias)]);

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
          background: "linear-gradient(135deg, #001f0d 0%, #000a04 100%)",
          border: "3px solid rgba(38,255,100,0.45)",
        }}
      >
        <div
          style={{
            display: "flex",
            letterSpacing: 6,
            fontSize: 22,
            fontWeight: 700,
            color: "#26ff64",
            marginBottom: 36,
          }}
        >
          MATRIX SPORTS ANALYTICS
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <TeamColumn side={game.teamA} logo={logoA} align="left" />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: 140,
              color: "#6fae83",
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            <div style={{ display: "flex" }}>VS</div>
            <div style={{ display: "flex", marginTop: 12, fontSize: 16, textAlign: "center" }}>
              {game.status === "final" ? "FINAL" : game.kickoff}
            </div>
          </div>
          <TeamColumn side={game.teamB} logo={logoB} align="right" />
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 40,
            fontSize: 18,
            color: "#6fae83",
          }}
        >
          100,000 Monte Carlo simulations · matrixsports.net
        </div>
      </div>
    ),
    size
  );
}
