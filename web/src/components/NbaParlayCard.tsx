import { SportsbookLink, PickResultIcon, formatOdds, formatPercent, SPORTSBOOK_INFO } from "@/components/ParlayCard";
import { DEFAULT_ODDS_FORMAT, type OddsFormat } from "@/lib/oddsFormat";
import type { NbaParlay, NbaParlayPick } from "@/lib/nbaParlayHelper";
import { applyLineEdit, buildPickKey, buildTileEditKey, resolveSavedEdit, type PropEditRow } from "@/lib/propEditMath";
import { PropEditButton } from "@/components/PropEditButton";

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

function legLabel(side: string, line: number, stat: string): string {
  return `${side} ${line} ${statLabel(stat)}`;
}

// What the player actually did, once the game is final -- null pre-game.
function legActualLabel(pick: NbaParlayPick): string | null {
  if (pick.actualValue === null) return null;
  return `actual ${pick.actualValue} ${statLabel(pick.stat)}`;
}

// Hit only when every NON-VOID leg is graded correct, missed as soon as
// any leg is graded incorrect, otherwise still pending (game not final
// yet). A 'void' leg (src4/40_grade_nba_player_props.py: the player was
// inactive/DNP, so it never gets a real actual_value) is dropped from
// consideration entirely -- same as a sportsbook settling a parlay around
// a scratched leg -- so it can't block the other legs from ever grading.
// All-void is the one edge case this can't resolve either way (no graded
// legs to judge by), so it falls through to "still pending" like before.
export function parlayOutcome(parlay: NbaParlay): "hit" | "missed" | null {
  const graded = parlay.legs.filter((l) => l.pick.pickResult !== "void");
  if (graded.some((l) => l.pick.pickResult === "incorrect")) return "missed";
  if (graded.length > 0 && graded.every((l) => l.pick.pickResult === "correct")) return "hit";
  return null;
}

function sportsbookName(key: string): string {
  return SPORTSBOOK_INFO[key]?.name ?? key;
}

export function NbaParlayCard({
  title,
  parlay,
  // Per-game cards (NbaGameDetailView.tsx's Parlay Helper tab) omit this
  // -- the game is implied by the page you're on. The league-wide
  // Parlays page (app/parlays/nba) sets this since its legs can come
  // from different games -- same showMatchup contract as ParlayCard.tsx
  // (NFL).
  showMatchup = false,
  // The signed-in user's My Bookies picks, when the caller has them --
  // only app/parlays/nba (page.tsx's filterDaysToEnabledBooks) passes
  // this, since only that page can fall back to a parlay outside the
  // user's own books (see sportsbookPrefs.ts's
  // filterParlaysToEnabledBooksWithFallback). Empty/omitted means "no
  // preference set" or "not applicable here" -- no badge either way.
  enabledBooks = [],
  // Disambiguates this parlay's picks for Line Edit's per-user edit
  // table (propEdits.ts/propEditMath.ts's buildPickKey) -- a per-game
  // page passes `game:${nbaGameId}`, the league-wide Parlays page passes
  // `day:${dayKey}`. Required: an edit saved under the wrong scope would
  // silently never show up again.
  scope,
  // The signed-in user's saved Line Edit overrides, keyed by
  // buildPickKey's own key -- omitted/empty means no edits, same as
  // before this feature existed.
  propEdits = {},
  // "Site Odds Preference" (profile page) -- defaults to American so
  // every call site that hasn't been updated to pass this yet keeps
  // rendering exactly as it did before this feature existed.
  oddsFormat = DEFAULT_ODDS_FORMAT,
}: {
  title: string;
  parlay: NbaParlay;
  showMatchup?: boolean;
  enabledBooks?: string[];
  scope: string;
  propEdits?: Record<string, PropEditRow>;
  oddsFormat?: OddsFormat;
}) {
  const outcome = parlayOutcome(parlay);
  const notYourBook =
    enabledBooks.length > 0 && parlay.sportsbook != null && !enabledBooks.includes(parlay.sportsbook);

  // Display-only overlay: apply any saved Line Edit per leg, then
  // recompute the tile's own combined probability/payout from whatever
  // is actually displayed. The site's own `parlay` object (which legs
  // make this tile, its graded outcome) is never touched -- see
  // propEditMath.ts's own header.
  const displayLegs = parlay.legs.map((leg) => {
    const p = leg.pick;
    const pickKeyAll = buildPickKey({
      league: "nba",
      scope,
      player: p.playerName,
      stat: p.stat,
      originalLine: p.line,
      originalSide: p.side,
    });
    const pickKeyTile = buildTileEditKey(pickKeyAll, title);
    const resolved = resolveSavedEdit(propEdits, pickKeyAll, pickKeyTile);
    const display = applyLineEdit(
      { projection: p.projection, originalLine: p.line, originalSide: p.side, originalProbability: leg.probability, originalOdds: leg.odds },
      resolved?.row
    );
    return { leg, pickKeyAll, pickKeyTile, activeScope: resolved?.appliesTo ?? null, display };
  });
  const anyEdited = displayLegs.some((l) => l.display.edited);
  const displayProbability = displayLegs.reduce((prod, l) => prod * l.display.probability, 1);
  const displayDecimalOdds = displayLegs.reduce((prod, l) => prod * l.display.decimalOdds, 1);

  return (
    <div className={`parlay-card${outcome && !anyEdited ? ` parlay-card-${outcome}` : ""}`}>
      <div className="parlay-card-head">
        <div className="parlay-card-titles">
          <span className="parlay-card-title">
            {title}
            {anyEdited ? (
              <span className="parlay-outcome parlay-outcome-customized">Customized</span>
            ) : (
              outcome && (
                <span className={`parlay-outcome parlay-outcome-${outcome}`}>{outcome === "hit" ? "Hit" : "Missed"}</span>
              )
            )}
          </span>
          <span className="parlay-card-book">
            {parlay.sportsbook ? (
              <>
                <SportsbookLink sportsbook={parlay.sportsbook} />
                All legs at {sportsbookName(parlay.sportsbook)}
                {notYourBook && <span className="parlay-card-book-warn">Not in your books</span>}
              </>
            ) : (
              "Legs are at different books"
            )}
          </span>
        </div>
        <div className="parlay-card-stats">
          <div className="parlay-stat">
            <span className="parlay-stat-value">{formatPercent(displayProbability)}</span>
            <span className="parlay-stat-label">chance to hit</span>
          </div>
          <div className="parlay-stat">
            <span className="parlay-stat-value parlay-stat-payout">${displayDecimalOdds.toFixed(2)}</span>
            <span className="parlay-stat-label">payout on a $1 bet</span>
            <span className="parlay-stat-sub">(${(displayDecimalOdds - 1).toFixed(2)} profit)</span>
          </div>
        </div>
      </div>
      <ul className="parlay-legs">
        {displayLegs.map(({ leg, pickKeyAll, pickKeyTile, activeScope, display }) => {
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
                  {display.edited ? <span className="parlay-leg-edited-tag">Edited</span> : <PickResultIcon result={p.pickResult} />}
                </div>
                {showMatchup && (
                  <div className="parlay-leg-matchup">
                    {p.team} vs {p.opponent}
                    {p.gameDay && ` (${p.gameDay})`}
                  </div>
                )}
                <div className="parlay-leg-pick">{legLabel(display.side, display.line, p.stat)}</div>
                {actualLabel && <div className="parlay-leg-actual">{actualLabel}</div>}
              </div>
              <div className="parlay-leg-odds">
                <SportsbookLink sportsbook={leg.sportsbook} />
                <span>{formatOdds(display.odds, oddsFormat)}</span>
              </div>
              <div className="parlay-leg-prob">{formatPercent(display.probability)}</div>
              <PropEditButton
                pickKeyAll={pickKeyAll}
                pickKeyTile={pickKeyTile}
                currentLine={display.line}
                currentSide={display.side}
                currentOdds={display.odds}
                hasEdit={display.edited}
                activeScope={activeScope}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
