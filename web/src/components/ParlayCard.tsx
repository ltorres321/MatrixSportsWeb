import type { PlayerPropEntry } from "@/lib/pffBettingEdge";
import type { Parlay } from "@/lib/parlayHelper";

// Shared by the per-game "Parlay Helper" tab (GameDetailView.tsx) and the
// league-wide "Parlays" page (app/parlays) -- both build the same Parlay
// shape (parlayHelper.ts / leagueParlayHelper.ts), just from a different
// pool of legs, so the card and its grading logic only need to exist once.

// The books below bovada are new (2026-10, from etl.player_prop_lines
// via SportsPipelines/prop_lines/ -- see sql/016's docstring) and their
// url is an unverified homepage root, not a click-through-confirmed
// NFL deep link like caesars/draftKings/betmgm/fanduel above -- safer
// to land on a page that definitely exists than guess a path that 404s.
export const SPORTSBOOK_INFO: Record<string, { name: string; url: string; logo: string }> = {
  caesars: {
    name: "Caesars Sportsbook",
    url: "https://sportsbook.caesars.com/us/nj/bet/americanfootball?id=007d7c61-07a7-4e18-bb40-15104b6eac92",
    logo: "/assets/favicons/caesars.png",
  },
  draftKings: {
    name: "DraftKings",
    url: "https://sportsbook.draftkings.com/leagues/football/nfl",
    logo: "/assets/favicons/draftkings.png",
  },
  // Same book as draftKings above, under the lowercase key
  // etl.player_prop_lines.bookmaker actually uses (SportsPipelines'
  // prop_lines/ pollers store each source's own lowercase key) -- PFF's
  // CSV-derived pick_sportsbook uses the capital-K spelling instead, so
  // both keys need an entry or a line-shopped DraftKings quote falls
  // through to the plain-text "unknown book" display.
  draftkings: {
    name: "DraftKings",
    url: "https://sportsbook.draftkings.com/leagues/football/nfl",
    logo: "/assets/favicons/draftkings.png",
  },
  betmgm: {
    name: "BetMGM",
    url: "https://www.nj.betmgm.com/en/engage/lan/geolocator?orh=sports.betmgm.com",
    logo: "/assets/favicons/betmgm.png",
  },
  fanduel: {
    name: "FanDuel",
    url: "https://sportsbook.fanduel.com/navigation/nfl",
    logo: "/assets/favicons/fanduel.png",
  },
  // Not yet confirmed by click-through like the other four (seen in
  // Player Props' pick_sportsbook, not First Touchdown's set) -- same
  // "general section, not a specific bet" reasoning, but this URL is
  // a best guess, not a verified one.
  fanatics: {
    name: "Fanatics Sportsbook",
    url: "https://sportsbook.fanatics.com/",
    logo: "/assets/favicons/fanatics.png",
  },
  bovada: {
    name: "Bovada",
    url: "https://www.bovada.lv/",
    logo: "/assets/favicons/bovada.png",
  },
  hardrock: {
    name: "Hard Rock Bet",
    url: "https://app.hardrock.bet/",
    logo: "/assets/favicons/hardrock.png",
  },
  espnbet: {
    name: "ESPN BET",
    url: "https://espnbet.com/",
    logo: "/assets/favicons/espnbet.png",
  },
  pinnacle: {
    name: "Pinnacle",
    url: "https://www.pinnacle.com/",
    logo: "/assets/favicons/pinnacle.png",
  },
  betrivers: {
    name: "BetRivers",
    url: "https://www.betrivers.com/",
    logo: "/assets/favicons/betrivers.png",
  },
  betway: {
    name: "Betway",
    url: "https://betway.com/",
    logo: "/assets/favicons/betway.png",
  },
  fliff: {
    name: "Fliff",
    url: "https://www.getfliff.com/",
    logo: "/assets/favicons/fliff.png",
  },
  rebet: {
    name: "Rebet",
    url: "https://rebet.app/",
    logo: "/assets/favicons/rebet.png",
  },
  sportzino: {
    name: "Sportzino",
    url: "https://sportzino.com/",
    logo: "/assets/favicons/sportzino.png",
  },
  courtside: {
    name: "Courtside",
    url: "https://www.courtside.app/",
    logo: "/assets/favicons/courtside.png",
  },
};

export function SportsbookLink({ sportsbook }: { sportsbook: string }) {
  const info = SPORTSBOOK_INFO[sportsbook];
  if (!info) return <span className="betting-sportsbook-unknown">{sportsbook}</span>;
  return (
    <a
      className="betting-sportsbook-link"
      href={info.url}
      target="_blank"
      rel="noopener noreferrer"
      title={`Odds via ${info.name}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={info.logo} alt={info.name} className="betting-sportsbook-icon" />
    </a>
  );
}

export function formatOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

// matchupPosition is "No Matchup" for backups PFF didn't run a
// matchup analysis on -- that's a real, honest signal about matchup
// *grade* availability (left alone everywhere else this entry is
// used), but it isn't the right answer to "what position do they
// play," which lineupPosition (sourced independently, from the same
// roster data First Touchdown's position column uses) still usually
// knows even when PFF's own matchup field doesn't.
export function displayPosition(entry: PlayerPropEntry): string | null {
  if (entry.matchupPosition && entry.matchupPosition !== "No Matchup") return entry.matchupPosition;
  return entry.lineupPosition;
}

// null pre-game (PFF hasn't graded it yet -- most props on this site,
// since most games haven't been played). Yellow check (this site's own
// accent color, not PFF's green) for a hit, red X for a miss -- same
// semantic PFF's own page uses, different color for the positive case
// to match the rest of the site's theme.
export function PickResultIcon({ result }: { result: string | null }) {
  if (result === "correct") {
    return (
      <span className="pick-result-icon pick-result-correct" title="Hit" aria-label="Correct pick">
        ✓
      </span>
    );
  }
  if (result === "incorrect") {
    return (
      <span className="pick-result-icon pick-result-incorrect" title="Miss" aria-label="Incorrect pick">
        ✕
      </span>
    );
  }
  return null;
}

export function formatPercent(p: number): string {
  return `${(p * 100).toFixed(1)}%`;
}

function parlayLegLabel(e: PlayerPropEntry): string {
  if (e.consensusStat === "Anytime TD") return "Anytime TD";
  return `${e.pickSide ?? ""} ${e.pickLine ?? ""} ${e.consensusStat}`.trim();
}

// What the player actually did, once the game is final -- null pre-game
// (see PlayerPropEntry.actualValue's own comment). "Anytime TD" stores
// actualValue as 1/0, not a yardage-style number, so it gets its own
// phrasing instead of "actual 1 Anytime TD".
function parlayLegActualLabel(e: PlayerPropEntry): string | null {
  if (e.actualValue === null) return null;
  if (e.consensusStat === "Anytime TD") return e.actualValue > 0 ? "actual: scored a TD" : "actual: no TD";
  return `actual ${e.actualValue} ${e.consensusStat}`;
}

// Hit only when every leg is graded correct, missed as soon as any leg
// is graded incorrect, otherwise still pending (game not final yet).
function parlayOutcome(parlay: Parlay): "hit" | "missed" | null {
  if (parlay.legs.some((l) => l.entry.pickResult === "incorrect")) return "missed";
  if (parlay.legs.every((l) => l.entry.pickResult === "correct")) return "hit";
  return null;
}

function sportsbookName(key: string): string {
  return SPORTSBOOK_INFO[key]?.name ?? key;
}

export function ParlayCard({
  title,
  parlay,
  // Per-game cards omit this -- the game is implied by the page you're on.
  // The league-wide Parlays page sets this since its legs can come from
  // different games.
  showMatchup = false,
}: {
  title: string;
  parlay: Parlay;
  showMatchup?: boolean;
}) {
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
          const e = leg.entry;
          const actualLabel = parlayLegActualLabel(e);
          return (
            <li key={`${e.playerName}-${e.consensusStat}`} className="parlay-leg">
              <span className="parlay-leg-rank" title="Rank within this game">
                {e.pRank}
              </span>
              <div className="parlay-leg-main">
                <div className="parlay-leg-player">
                  <span className="betting-player-team">{e.playerTeam}</span> {e.playerName}
                  {displayPosition(e) && <span className="betting-player-position">({displayPosition(e)})</span>}
                  <PickResultIcon result={e.pickResult} />
                </div>
                {showMatchup && (
                  <div className="parlay-leg-matchup">
                    {e.playerTeam} vs {e.opponentTeam}
                  </div>
                )}
                <div className="parlay-leg-pick">{parlayLegLabel(e)}</div>
                {actualLabel && <div className="parlay-leg-actual">{actualLabel}</div>}
              </div>
              <div className="parlay-leg-odds">
                {leg.sportsbook && <SportsbookLink sportsbook={leg.sportsbook} />}
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
