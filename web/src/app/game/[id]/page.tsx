import Link from "next/link";
import { getGameDetail, formatKickoff } from "@/lib/predictions";
import { getScheduledGame } from "@/lib/schedule";
import { getStoryForGame } from "@/lib/stories";
import { teamByAlias, teamLogoPath } from "@/lib/teams";
import GameDetailView from "./GameDetailView";

function teamDisplay(alias: string): string {
  const team = teamByAlias(alias);
  return team ? `${team.market} ${team.name}` : alias;
}

// Per-game title/description (shown in search results, browser tabs,
// and as the fallback text on a share preview) plus an explicit
// "summary_large_image" Twitter card -- without this Twitter falls
// back to its small thumbnail card even though opengraph-image.tsx
// already supplies a full-size image.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const game = await getGameDetail(id);
  if (!game) return {};

  const a = teamDisplay(game.teamA.alias);
  const b = teamDisplay(game.teamB.alias);
  const description =
    game.status === "final"
      ? `Final: ${a} ${game.teamA.score} — ${b} ${game.teamB.score}. See the model's pregame win probability and how it played out.`
      : `${a} ${game.teamA.winProb}% to win vs ${b} ${game.teamB.winProb}% — from 100,000 simulated games.`;

  return {
    title: `${a} vs ${b} — Win Probability | Matrix Sports Analytics`,
    description,
    twitter: { card: "summary_large_image" },
  };
}

export default async function GameDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const game = await getGameDetail(id);
  if (game) {
    const story = game.finalResult ? await getStoryForGame(id) : null;
    return <GameDetailView game={game} story={story} />;
  }

  // No prediction row yet -- fall back to the schedule (kickoff time,
  // and the real score once it's played) rather than a dead end.
  const scheduled = await getScheduledGame(id);
  if (!scheduled) {
    return (
      <main>
        <p style={{ textAlign: "center", color: "var(--text-dim)" }}>
          No prediction found for this game.
        </p>
      </main>
    );
  }

  return (
    <main>
      <Link href="/home" style={{ display: "inline-block", marginBottom: "1.5rem", color: "var(--text-dim)" }}>
        &larr; back to predictions
      </Link>
      <div className="game-hero">
        <div className="matchup-status" style={{ justifyContent: "center", marginBottom: "1.5rem" }}>
          <span className={`tag ${scheduled.final ? "final" : "preview"}`}>
            {scheduled.final ? "FINAL" : formatKickoff(scheduled.game_date)}
          </span>
        </div>
        <div className="game-hero-teams">
          <div className="game-hero-team">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={teamLogoPath(scheduled.away_team)} alt={`${teamDisplay(scheduled.away_team)} logo`} />
            <div className="name">{teamDisplay(scheduled.away_team)}</div>
            {scheduled.final && <div className="big-prob">{scheduled.actual_away_score}</div>}
          </div>
          <div className="game-hero-vs">VS</div>
          <div className="game-hero-team">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={teamLogoPath(scheduled.home_team)} alt={`${teamDisplay(scheduled.home_team)} logo`} />
            <div className="name">{teamDisplay(scheduled.home_team)}</div>
            {scheduled.final && <div className="big-prob">{scheduled.actual_home_score}</div>}
          </div>
        </div>
        <div className="game-hero-meta">
          {scheduled.final
            ? "The model hasn't generated a prediction for this game -- only the real result is shown above."
            : "The model hasn't generated a prediction for this game yet -- check back closer to kickoff."}
        </div>
      </div>
    </main>
  );
}
