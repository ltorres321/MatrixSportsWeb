import { readFile } from "fs/promises";
import path from "path";
import { ImageResponse } from "next/og";
import { getGameDetail } from "@/lib/predictions";
import { teamByAlias } from "@/lib/teams";
import { teamPrimaryColor } from "@/lib/teamColors";
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

// Thin diagonal accent bars behind everything -- pure CSS "speed
// lines," not a photo, but they're what actually reads as motion/
// energy rather than a static data card. Real NFL game photography
// would need a licensed source (Getty/AP) this project doesn't have;
// this is the legally-safe way to get some of that same kinetic feel.
function SpeedLines() {
  const lines = [
    { top: 40, width: 340, opacity: 0.14 },
    { top: 130, width: 520, opacity: 0.1 },
    { top: 480, width: 460, opacity: 0.12 },
    { top: 560, width: 300, opacity: 0.08 },
  ];
  return (
    <div style={{ display: "flex", position: "absolute", inset: 0 }}>
      {lines.map((l, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            position: "absolute",
            left: -80,
            top: l.top,
            width: l.width,
            height: 10,
            background: "#26ff64",
            opacity: l.opacity,
            transform: "rotate(-8deg)",
          }}
        />
      ))}
    </div>
  );
}

// A soft color wash behind each team's logo, from that team's own
// real brand color -- not a dominant background (this still needs to
// read as MATRIX SPORTS ANALYTICS first, not a team's own graphic),
// just enough to give each side a distinct identity beyond the logo
// alone. Layered circles standing in for a blurred glow, since
// filter: blur isn't reliably supported by the image renderer here.
function ColorWash({ color }: { color: string }) {
  return (
    <div style={{ display: "flex", position: "absolute", width: 420, height: 420, top: -80, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", position: "absolute", width: 420, height: 420, borderRadius: 999, background: color, opacity: 0.16 }} />
      <div style={{ display: "flex", position: "absolute", width: 300, height: 300, borderRadius: 999, background: color, opacity: 0.14 }} />
      <div style={{ display: "flex", position: "absolute", width: 190, height: 190, borderRadius: 999, background: color, opacity: 0.12 }} />
    </div>
  );
}

function TeamColumn({ side, logo }: { side: GameStatSide; logo: string }) {
  const showScore = side.score !== undefined;
  const color = teamPrimaryColor(side.alias);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 340, position: "relative" }}>
      <ColorWash color={color} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo} width={132} height={132} alt="" style={{ zIndex: 1 }} />
      <div
        style={{
          display: "flex",
          marginTop: 20,
          fontSize: 30,
          fontWeight: 700,
          color: "#f4fff9",
          textAlign: "center",
          zIndex: 1,
        }}
      >
        {teamDisplay(side.alias)}
      </div>
      <div
        style={{
          display: "flex",
          marginTop: 14,
          fontSize: 78,
          fontWeight: 800,
          color: showScore ? "#f4fff9" : "#26ff64",
          transform: "rotate(-3deg)",
          zIndex: 1,
        }}
      >
        {showScore ? side.score : `${side.winProb}%`}
      </div>
      {!showScore && (
        <div style={{ display: "flex", fontSize: 17, color: "#6fae83", marginTop: 6, letterSpacing: 2, zIndex: 1 }}>
          WIN PROBABILITY
        </div>
      )}
    </div>
  );
}

// Broadcast-graphic-style angled ribbon for the game's status, instead
// of small plain centered text -- the one piece of the old design
// that read most like a plain data card rather than a sports
// scoreboard. Status text ranges from "FINAL"/"LIVE" (short) to a
// full kickoff string like "SUN 4:25 PM ET" (long) -- sized and
// widened for the long case so it never overflows past the canvas
// edge the way a fixed size did for anything longer than "FINAL".
function StatusRibbon({ text }: { text: string }) {
  const long = text.length > 7;
  return (
    <div
      style={{
        display: "flex",
        position: "absolute",
        top: 36,
        right: -18,
        width: long ? 380 : 260,
        justifyContent: "center",
        paddingTop: 8,
        paddingBottom: 8,
        background: "#26ff64",
        color: "#001a0a",
        fontSize: long ? 16 : 20,
        fontWeight: 800,
        letterSpacing: long ? 1.5 : 3,
        transform: "rotate(8deg)",
      }}
    >
      {text}
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
  const statusText = game.status === "final" ? "FINAL" : game.status === "live" ? "LIVE" : game.kickoff.toUpperCase();

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
          background: "radial-gradient(circle at 50% 38%, #002c14 0%, #000a04 72%)",
          border: "3px solid rgba(38,255,100,0.45)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <SpeedLines />
        <StatusRibbon text={statusText} />

        <div
          style={{
            display: "flex",
            letterSpacing: 6,
            fontSize: 22,
            fontWeight: 700,
            color: "#26ff64",
            marginBottom: 30,
            zIndex: 1,
          }}
        >
          MATRIX SPORTS ANALYTICS
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }}>
          <TeamColumn side={game.teamA} logo={logoA} />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: 120,
              color: "#6fae83",
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            <div style={{ display: "flex" }}>VS</div>
          </div>
          <TeamColumn side={game.teamB} logo={logoB} />
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 34,
            fontSize: 18,
            color: "#6fae83",
            zIndex: 1,
          }}
        >
          100,000 Monte Carlo simulations · matrixsports.net
        </div>
      </div>
    ),
    size
  );
}
