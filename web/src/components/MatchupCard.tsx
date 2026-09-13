import Link from "next/link";
import { teamByAlias, teamLogoPath } from "@/lib/teams";
import type { Matchup, TeamSide } from "@/lib/matchups";

function StatusTag({ status }: { status: Matchup["status"] }) {
  if (status === "live") {
    return (
      <span className="tag live">
        <span className="blip" />
        LIVE
      </span>
    );
  }
  if (status === "final") {
    return <span className="tag final">FINAL</span>;
  }
  return <span className="tag preview">UPCOMING</span>;
}

function TeamRow({
  side,
  status,
  predictionCorrect,
}: {
  side: TeamSide;
  status: Matchup["status"];
  predictionCorrect?: boolean;
}) {
  const team = teamByAlias(side.alias);
  const displayName = team ? `${team.market} ${team.name}` : side.alias;
  const showScore = status === "final" || status === "live";

  // Only the row of the team that actually won gets graded -- green
  // if that team was also the model's pick, red if it was an upset.
  // Ungraded (no prediction, or a tie) keeps the old neutral highlight.
  const winnerClass = !side.winner
    ? ""
    : predictionCorrect === true
      ? "winner pred-correct"
      : predictionCorrect === false
        ? "winner pred-wrong"
        : "winner";

  return (
    <div className={`team-row ${winnerClass}`}>
      <div className="team-badge">
        {/* eslint-disable-next-line @next/next/no-img-element -- fixed small logo set in /public, next/image adds no benefit here */}
        <img src={teamLogoPath(side.alias)} alt={`${displayName} logo`} />
      </div>
      <div className="team-info">
        <div className="team-name">{displayName}</div>
        <div className="team-record">{side.record}</div>
      </div>
      <div className="team-metric">
        {showScore ? (
          <>
            <div className="team-score">{side.score}</div>
            {status === "final" && side.prob !== undefined && (
              <div className="team-prob-pregame">Predicted {side.prob}%</div>
            )}
          </>
        ) : side.prob !== undefined ? (
          <>
            <div className="team-prob">{side.prob}%</div>
            <div className="prob-bar">
              <div className="prob-bar-fill" style={{ width: `${side.prob}%` }} />
            </div>
          </>
        ) : (
          <div className="team-prob" style={{ opacity: 0.5 }}>
            —
          </div>
        )}
      </div>
    </div>
  );
}

export default function MatchupCard({
  matchup,
  premier,
  linkHref,
}: {
  matchup: Matchup;
  premier?: boolean;
  // Overrides the default /game/[id] destination -- e.g. the signed-out
  // landing page sends this click to /login instead of the game detail
  // page, since that page isn't part of the pre-signup marketing pitch.
  linkHref?: string;
}) {
  const premierClass = premier ? `premier-card ${matchup.lockOfWeek ? "gold" : ""}` : "";
  const card = (
    <div className={`matchup-card ${premierClass}`}>
      <div className="matchup-status">
        <StatusTag status={matchup.status} />
        <span className="game-meta">{matchup.kickoff}</span>
      </div>
      <TeamRow side={matchup.teamA} status={matchup.status} predictionCorrect={matchup.predictionCorrect} />
      <div className="vs-divider">VS</div>
      <TeamRow side={matchup.teamB} status={matchup.status} predictionCorrect={matchup.predictionCorrect} />
    </div>
  );

  return (
    <Link className="matchup-card-link" href={linkHref ?? `/game/${matchup.id}`}>
      {card}
    </Link>
  );
}
