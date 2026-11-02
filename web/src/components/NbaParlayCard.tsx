import { SportsbookLink, PickResultIcon, formatOdds, formatPercent, SPORTSBOOK_INFO } from "@/components/ParlayCard";
import type { NbaParlay, NbaParlayPick } from "@/lib/nbaParlayHelper";

// NBA counterpart to ParlayCard.tsx -- same markup/CSS classes (reused
// as-is, see globals.css's .parlay-* rules), built from NbaParlay's own
// shape instead of PFF's PlayerPropEntry-based Parlay. No "Anytime TD"/
// matchup-position concepts here (basketball has neither), so the leg
// label/actual-value helpers below are simpler than ParlayCard.tsx's own.

// Same raw-stat -> display-label map NbaGameDetailView.tsx's
// BettingEdgeTab uses (duplicated locally, not imported, for the same
// "NBA keeps parallel-but-separate implementations" reason that file's
// own header gives -- a view file and a components file each owning
// their own tiny copy of an 8-entry map is cheaper than threading a
// shared import between them).
const STAT_DISPLAY_LABEL: Record<string, string> = {
  points: "Points", rebounds: "Rebounds", assists: "Assists",
  threes: "Threes", blocks: "Blocks", steals: "Steals",
  turnovers: "Turnovers", pra: "PRA",
};

function statLabel(stat: string): string {
  return STAT_DISPLAY_LABEL[stat] ?? stat;
}

function legLabel(pick: NbaParlayPick): string {
  return `${pick.side} ${pick.line} ${statLabel(pick.stat)}`;
}

// What the player actually did, once the game is final -- null pre-game.
function legActualLabel(pick: NbaParlayPick): string | null {
  if (pick.actualValue === null) return null;
  return `actual ${pick.actualValue} ${statLabel(pick.stat)}`;
}

// Hit only when every leg is graded correct, missed as soon as any leg
// is graded incorrect, otherwise still pending (game not final yet).
function parlayOutcome(parlay: NbaParlay): "hit" | "missed" | null {
  if (parlay.legs.some((l) => l.pick.pickResult === "incorrect")) return "missed";
  if (parlay.legs.every((l) => l.pick.pickResult === "correct")) return "hit";
  return null;
}

function sportsbookName(key: string): string {
  return SPORTSBOOK_INFO[key]?.name ?? key;
}

export function NbaParlayCard({ title, parlay }: { title: string; parlay: NbaParlay }) {
  const outcome = parlayOutcome(parlay);
  return (
    <div className={`parlay-card${outcome ? ` parlay-card-${outcome}` : ""}`}>
      <div className="parlay-card-head">
        <div className="parlay-card-titles">
          <span className="parlay-card-title">
            {title}
            {outcome && (
              <span className={`parlay-outcome parlay-outcome-${outcome}`}>{outcome === "hit" ? "Hit" : "Missed"}</span>
            )}
          </span>
          <span className="parlay-card-book">
            {parlay.sportsbook ? (
              <>
                <SportsbookLink sportsbook={parlay.sportsbook} />
                All legs at {sportsbookName(parlay.sportsbook)}
              </>
            ) : (
              "Legs are at different books"
            )}
          </span>
        </div>
        <div className="parlay-card-stats">
          <div className="parlay-stat">
            <span className="parlay-stat-value">{formatPercent(parlay.probability)}</span>
            <span className="parlay-stat-label">chance to hit</span>
          </div>
          <div className="parlay-stat">
            <span className="parlay-stat-value parlay-stat-payout">${parlay.decimalOdds.toFixed(2)}</span>
            <span className="parlay-stat-label">payout on a $1 bet</span>
            <span className="parlay-stat-sub">(${(parlay.decimalOdds - 1).toFixed(2)} profit)</span>
          </div>
        </div>
      </div>
      <ul className="parlay-legs">
        {parlay.legs.map((leg) => {
          const p = leg.pick;
          const actualLabel = legActualLabel(p);
          return (
            <li key={`${p.playerName}-${p.stat}`} className="parlay-leg">
              <span className="parlay-leg-rank" title="Rank within this game">
                {p.pRank}
              </span>
              <div className="parlay-leg-main">
                <div className="parlay-leg-player">
                  <span className="betting-player-team">{p.team}</span> {p.playerName}
                  <PickResultIcon result={p.pickResult} />
                </div>
                <div className="parlay-leg-pick">{legLabel(p)}</div>
                {actualLabel && <div className="parlay-leg-actual">{actualLabel}</div>}
              </div>
              <div className="parlay-leg-odds">
                <SportsbookLink sportsbook={leg.sportsbook} />
                <span>{formatOdds(leg.odds)}</span>
              </div>
              <div className="parlay-leg-prob">{formatPercent(leg.probability)}</div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
