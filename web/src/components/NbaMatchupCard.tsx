import Link from "next/link";
import type { Matchup, TeamSide } from "@/lib/matchups";
import { NBA_TEAMS, teamLogoPath } from "@/lib/teamsNba";

// NBA equivalent of MatchupCard.tsx. Originally trimmed to skip
// winner/final-score styling on the stated assumption that "every row
// is a genuine upcoming game right now" -- no longer true now that
// nbaPredictions.ts's getMatchupsForNbaDate checks nbaSchedule.ts's
// TheSportsDB fallback for a real final score, so this now mirrors
// MatchupCard.tsx's StatusTag/showScore logic for real (this card was
// never wired to read matchup.status/score at all -- the data-layer
// fix alone wasn't enough, a completed game just silently kept
// showing "UPCOMING" with no score here). No predictionCorrect/
// trending-arrow/premier/recap-link: none of those are computed for
// NBA yet.
//
// Team logos (teamsNba.ts) were added 2026-10-24, downloaded from
// TheSportsDB -- `side.alias` holds the full display name (see
// nbaPredictions.ts), so the alias code for the logo lookup is
// re-derived from it via teamByAlias's own market+name match below,
// falling back to the letter badge for any name that doesn't match
// (defensive, not expected to actually happen for a real NBA team).
//
// predictionCorrect/pred-correct/pred-wrong (green win vs. red upset)
// now mirrors MatchupCard.tsx (NFL) too -- nbaPredictions.ts computes
// it the same way predictions.ts's computeCorrect() does, no trending-
// arrow/premier/recap-link yet (still none of those for NBA).
//
// LIVE status now mirrors MatchupCard.tsx too -- nbaPredictions.ts
// always had a `status: "live"` case in the shared Matchup type, but
// this card never had a branch for it (only "final" vs. a default
// "UPCOMING"), so a game actually in progress right now still showed
// "UPCOMING" with a pregame win probability instead of its real score
// -- confirmed live: Nuggets/Pelicans was in overtime, 136-134, while
// this card still said "UPCOMING."
//
// `premier` added for the home page's featured-game slot -- sizing
// only (the shared .premier-card CSS), no gold lock-of-week variant:
// there's no NBA equivalent of lockOfWeek/premierLabel yet.

function StatusTag({ status }: { status: Matchup["status"] }) {
  if (status === "final") {
    return <span className="tag final">FINAL</span>;
  }
  if (status === "live") {
    return (
      <span className="tag live">
        <span className="blip" />
        LIVE
      </span>
    );
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
  const team = NBA_TEAMS.find((t) => `${t.market} ${t.name}` === side.alias);
  const showScore = status === "final" || status === "live";

  // Same grading classes MatchupCard.tsx (NFL) uses: only the row of
  // the team that actually won gets graded -- green if that team was
  // also the model's pick, red if it was an upset. Ungraded (no
  // prediction, or a tie) keeps the plain neutral highlight.
  const winnerClass = !side.winner
    ? ""
    : predictionCorrect === true
      ? "winner pred-correct"
      : predictionCorrect === false
        ? "winner pred-wrong"
        : "winner";

  return (
    <div className={`team-row ${winnerClass}`}>
      {team ? (
        <div className="team-badge">
          {/* eslint-disable-next-line @next/next/no-img-element -- fixed small logo set in /public, next/image adds no benefit here */}
          <img src={teamLogoPath(team.alias)} alt={`${side.alias} logo`} />
        </div>
      ) : (
        // .fallback is an existing, already-styled MatchupCard variant
        // for exactly this case: a letter badge instead of a logo image.
        <div className="team-badge fallback" aria-hidden="true">
          {side.alias.split(" ").pop()?.slice(0, 1)}
        </div>
      )}
      <div className="team-info">
        <div className="team-name">{side.alias}</div>
        <div className="team-record">{side.record}</div>
      </div>
      <div className="team-metric">
        {showScore ? (
          <>
            <div className="team-score">{side.score}</div>
            {side.prob !== undefined && (
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

export default function NbaMatchupCard({
  matchup,
  premier,
}: {
  matchup: Matchup;
  premier?: boolean;
}) {
  return (
    <Link className="matchup-card-link" href={`/nba/game/${matchup.id}`}>
    <div className={`matchup-card ${premier ? "premier-card" : ""}`}>
      <div className="matchup-status">
        <StatusTag status={matchup.status} />
        <span className="game-meta">{matchup.kickoff}</span>
      </div>
      <TeamRow side={matchup.teamA} status={matchup.status} predictionCorrect={matchup.predictionCorrect} />
      <div className="vs-divider">VS</div>
      <TeamRow side={matchup.teamB} status={matchup.status} predictionCorrect={matchup.predictionCorrect} />
    </div>
    </Link>
  );
}
