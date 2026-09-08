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

function TeamRow({ side, status }: { side: TeamSide; status: Matchup["status"] }) {
  const team = teamByAlias(side.alias);
  const displayName = team ? `${team.market} ${team.name}` : side.alias;
  const isFinal = status === "final";

  return (
    <div className={`team-row ${side.winner ? "winner" : ""}`}>
      <div className="team-badge">
        {/* eslint-disable-next-line @next/next/no-img-element -- fixed small logo set in /public, next/image adds no benefit here */}
        <img src={teamLogoPath(side.alias)} alt={`${displayName} logo`} />
      </div>
      <div className="team-info">
        <div className="team-name">{displayName}</div>
        <div className="team-record">{side.record}</div>
      </div>
      <div className="team-metric">
        {isFinal ? (
          <div className="team-score">{side.score}</div>
        ) : (
          <>
            <div className="team-prob">{side.prob}%</div>
            <div className="prob-bar">
              <div className="prob-bar-fill" style={{ width: `${side.prob}%` }} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function MatchupCard({ matchup, premier }: { matchup: Matchup; premier?: boolean }) {
  const card = (
    <div className={`matchup-card ${premier ? "premier-card" : ""}`}>
      <div className="matchup-status">
        <StatusTag status={matchup.status} />
        <span className="game-meta">{matchup.kickoff}</span>
      </div>
      <TeamRow side={matchup.teamA} status={matchup.status} />
      <div className="vs-divider">VS</div>
      <TeamRow side={matchup.teamB} status={matchup.status} />
    </div>
  );

  return (
    <Link className="matchup-card-link" href={`/game/${matchup.id}`}>
      {card}
    </Link>
  );
}
