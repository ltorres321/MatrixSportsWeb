import type { PlayerPropEntry } from "@/lib/pffBettingEdge";
import type { Parlay } from "@/lib/parlayHelper";
import { applyLineEdit, buildPickKey, buildTileEditKey, resolveSavedEdit, type EditScope, type PropEditRow } from "@/lib/propEditMath";
import { PropEditButton } from "@/components/PropEditButton";
import { formatOdds, DEFAULT_ODDS_FORMAT, type OddsFormat } from "@/lib/oddsFormat";

// Shared by the per-game "Parlay Helper" tab (GameDetailView.tsx) and the
// league-wide "Parlays" page (app/parlays) -- both build the same Parlay
// shape (parlayHelper.ts / leagueParlayHelper.ts), just from a different
// pool of legs, so the card and its grading logic only need to exist once.

// The books below bovada are new (2026-10, from etl.player_prop_lines
// via SportsPipelines/prop_lines/ -- see sql/016's docstring) and their
// url is an unverified homepage root, not a click-through-confirmed
// NFL deep link like caesars/draftKings/betmgm/fanduel above -- safer
// to land on a page that definitely exists than guess a path that 404s.
// url/logo are optional: a handful of "bookmaker" keys in the raw odds
// feeds (e.g. dst_propbuilder, see its own entry below) aren't a site a
// user can actually wager on -- for those, SportsbookLink renders a
// plain, non-clickable label instead of a dead link, rather than let a
// user click through expecting a real book and find nothing.
//
// logo is the DARK-theme icon (this site's default theme); logoLight,
// when present, overrides it under :root[data-theme="light"] (see the
// .betting-sportsbook-icon-light/-dark toggle in globals.css). Most
// books' real-world logo already reads fine on both -- only add
// logoLight for a book where one single icon is genuinely unreadable
// on one of the two themes (confirmed live: fanatics.png's black mark
// disappears against this site's dark backdrop; UnibetWo.png's white
// outline disappears against the light theme's white page background).
export const SPORTSBOOK_INFO: Record<string, { name: string; url?: string; logo?: string; logoLight?: string }> = {
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
    // Black mark is unreadable against this site's dark theme -- white
    // variant for dark (the default), the original black one for light.
    logo: "/assets/favicons/fanatics-white.png",
    logoLight: "/assets/favicons/fanatics.png",
  },
  bovada: {
    name: "Bovada",
    url: "https://www.bovada.lv/",
    logo: "/assets/favicons/bovada.png",
  },
  // Offshore, like bovada/bet99 -- real retail wagering accounts, just
  // not US-licensed -- but confirmed by the user (2026-11-16) as usable
  // by US bettors in practice, so this one stays OUT of BANNED_US_BOOKS
  // (unlike bet99). No logo asset on hand yet, so this falls back to
  // SportsbookLink's plain-text label (see this file's own header
  // comment) until one's added.
  betonlineag: {
    name: "BetOnline.ag",
    url: "https://www.betonline.ag/",
  },
  // Same offshore-but-usable category as betonlineag above (user,
  // 2026-11-16: "seem legit sites, they reside outside us but I can
  // create account"). No logo asset yet -- plain-text fallback.
  lowvig: {
    name: "LowVig.ag",
    url: "https://www.lowvig.ag/",
  },
  // Confirmed by the user (2026-11-16: "looks like I can place parlays
  // for real money and create an account") -- a normal real-money book
  // here, not NON_RETAIL_BOOKS/pick6's DFS-pick'em category. No logo
  // asset yet -- plain-text fallback.
  parlayplay: {
    name: "ParlayPlay",
    url: "https://parlayplay.io/",
  },
  // Licensed US real-money sportsbook (Penn Entertainment/theScore
  // brand) -- a normal selectable book, no different category from
  // draftkings/fanduel/etc. No logo asset yet -- plain-text fallback.
  thescorebet: {
    name: "theScore Bet",
    url: "https://www.thescore.bet/",
  },
  // Canada-only -- not legally available to US bettors (confirmed by the
  // user, 2026-11), so also added to pffBettingEdge.ts's BANNED_US_BOOKS.
  // Still gets a real icon here since this entry is theme-independent of
  // that filter -- a non-US reader, or the toggle switched off, still
  // sees a proper icon instead of a plain-text fallback.
  bet99: {
    name: "Bet99",
    url: "https://bet99.com/",
    logo: "/assets/favicons/Bet99_Dark.png",
    logoLight: "/assets/favicons/Bet99_Light.png",
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
  tonybet: {
    name: "TonyBet",
    url: "https://tonybet.com/",
    logo: "/assets/favicons/Tonybet.png",
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
  // Added 2026-10-27 for NBA's player-prop bookmaker set
  // (etl.player_prop_lines_current) -- same "unverified homepage
  // root" caveat as fanatics/bovada above, plus these three
  // specifically are exchanges/international books, not U.S. retail
  // sportsbooks, so double-check availability in your jurisdiction
  // before relying on the link.
  novig: {
    name: "Novig",
    url: "https://novig.us/",
    logo: "/assets/favicons/novig-favicon.ico",
  },
  stoiximan: {
    name: "Stoiximan",
    url: "https://www.stoiximan.gr/",
    logo: "/assets/favicons/stoiximan.png",
  },
  onexbet: {
    name: "1xBet",
    url: "https://1xbet.com/",
    logo: "/assets/favicons/onexbet-favicon.ico",
  },
  pick6: {
    name: "DraftKings Pick6",
    url: "https://pick6.draftkings.com/",
    logo: "/assets/favicons/Pick6.png",
  },
  unibet: {
    name: "Unibet",
    url: "https://unibet.com/",
    // White-outline mark reads fine on dark, disappears on light --
    // the plain-color mark for light instead.
    logo: "/assets/favicons/UnibetWo.png",
    logoLight: "/assets/favicons/Unibet.png",
  },
  // Greek-licensed (ΕΕΕΠ), not legally available to US bettors (user,
  // 2026-11-08) -- also added to pffBettingEdge.ts's BANNED_US_BOOKS,
  // same "Canada-only"/stoiximan pattern as bet99 above. elabet.gr
  // itself renders its logo via JS and blocks a direct favicon
  // request, so this is a copy from a review site (bethome.gr) --
  // small (150x150) but fine at this component's icon size.
  elabet: {
    name: "Elabet",
    url: "https://www.elabet.gr/",
    logo: "/assets/favicons/elabet.jpg",
  },
  // dst_propbuilder (Digital Sports Tech's "Prop Builder") deliberately
  // has NO entry here -- it's not a sportsbook a user can visit and
  // wager on, just backend odds-generation infrastructure licensed by
  // real operators. Per the user's "no good anywhere, suppress them"
  // (2026-10-31), its lines are excluded at the query level instead
  // (nbaGameDetail.ts's propRows WHERE clause, pffBettingEdge.ts's
  // bookmaker NOT IN lists, src4/33's EXCLUDED_BOOKMAKERS) -- they
  // never reach this component at all, so there's nothing to render
  // a label for.
};

export function SportsbookLink({ sportsbook }: { sportsbook: string }) {
  const info = SPORTSBOOK_INFO[sportsbook];
  if (!info) return <span className="betting-sportsbook-unknown">{sportsbook}</span>;
  if (!info.url || !info.logo) {
    return (
      <span className="betting-sportsbook-unknown" title="Not a sportsbook -- odds source only, no wagering here">
        {info.name}
      </span>
    );
  }
  return (
    <a
      className="betting-sportsbook-link"
      href={info.url}
      target="_blank"
      rel="noopener noreferrer"
      title={`Odds via ${info.name}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={info.logo}
        alt={info.name}
        className={`betting-sportsbook-icon${info.logoLight ? " betting-sportsbook-icon-dark" : ""}`}
      />
      {info.logoLight && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={info.logoLight} alt={info.name} className="betting-sportsbook-icon betting-sportsbook-icon-light" />
      )}
    </a>
  );
}

// Re-exported so existing importers (NbaParlayCard.tsx, GameDetailView.tsx)
// don't need their own import line change -- the canonical definition
// (and the OddsFormat type/ODDS_FORMATS list) now lives in oddsFormat.ts
// since it's a pure value, not UI, and the profile page needs it too.
export { formatOdds, type OddsFormat };

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
  // NBA-only so far (src4/40_grade_nba_player_props.py, 2026-11-07): the
  // player was inactive/DNP for a completed game, so there's no real stat
  // to grade against -- same convention a real sportsbook uses for a
  // scratched player (void/push), not a loss and not left pending forever.
  if (result === "void") {
    return (
      <span className="pick-result-icon pick-result-void" title="Void (did not play)" aria-label="Void pick">
        —
      </span>
    );
  }
  return null;
}

export function formatPercent(p: number): string {
  return `${(p * 100).toFixed(1)}%`;
}

function parlayLegLabel(e: PlayerPropEntry, side?: string, line?: number): string {
  if (e.consensusStat === "Anytime TD") return "Anytime TD";
  return `${side ?? e.pickSide ?? ""} ${line ?? e.pickLine ?? ""} ${e.consensusStat}`.trim();
}

// Line Edit (user, 2026-11-15) only applies to a real over/under line --
// "Anytime TD" is a binary yes/no market with no line/side to edit, and
// a leg missing pickLine/pickSide has nothing for recomputeProbability
// to work from. Those legs just don't get an Edit button.
function isEditableLeg(e: PlayerPropEntry): e is PlayerPropEntry & { pickLine: number; pickSide: "over" | "under" } {
  return e.consensusStat !== "Anytime TD" && e.pickLine != null && (e.pickSide === "over" || e.pickSide === "under");
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
  // Disambiguates this parlay's picks for Line Edit's per-user edit
  // table (propEditMath.ts's buildPickKey) -- a per-game page passes
  // `game:${universalGameId}`, the league-wide Parlays page passes
  // `week:${season}-${week}`. Required: an edit saved under the wrong
  // scope would silently never show up again.
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
  parlay: Parlay;
  showMatchup?: boolean;
  scope: string;
  propEdits?: Record<string, PropEditRow>;
  oddsFormat?: OddsFormat;
}) {
  const outcome = parlayOutcome(parlay);

  // Display-only overlay: apply any saved Line Edit per leg (only legs
  // isEditableLeg allows), then recompute the tile's own combined
  // probability/payout from whatever is actually displayed. The site's
  // own `parlay` object (which legs make this tile, its graded outcome)
  // is never touched -- see propEditMath.ts's own header.
  const displayLegs = parlay.legs.map((leg) => {
    const e = leg.entry;
    if (!isEditableLeg(e)) {
      return {
        leg,
        pickKeyAll: null as string | null,
        pickKeyTile: null as string | null,
        activeScope: null as EditScope | null,
        display: {
          line: e.pickLine ?? undefined,
          side: e.pickSide ?? undefined,
          odds: leg.odds,
          probability: leg.probability,
          decimalOdds: leg.decimalOdds,
          edited: false,
        },
      };
    }
    const pickKeyAll = buildPickKey({
      league: "nfl",
      scope,
      player: e.playerName,
      stat: e.consensusStat,
      originalLine: e.pickLine,
      originalSide: e.pickSide,
    });
    const pickKeyTile = buildTileEditKey(pickKeyAll, title);
    const resolved = resolveSavedEdit(propEdits, pickKeyAll, pickKeyTile);
    const display = applyLineEdit(
      { projection: e.projValue, originalLine: e.pickLine, originalSide: e.pickSide, originalProbability: leg.probability, originalOdds: leg.odds },
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
                  {display.edited ? <span className="parlay-leg-edited-tag">Edited</span> : <PickResultIcon result={e.pickResult} />}
                </div>
                {showMatchup && (
                  <div className="parlay-leg-matchup">
                    {e.playerTeam} vs {e.opponentTeam}
                    {e.gameDay && ` (${e.gameDay})`}
                  </div>
                )}
                <div className="parlay-leg-pick">{parlayLegLabel(e, display.side, display.line)}</div>
                {actualLabel && <div className="parlay-leg-actual">{actualLabel}</div>}
              </div>
              <div className="parlay-leg-odds">
                {leg.sportsbook && <SportsbookLink sportsbook={leg.sportsbook} />}
                <span>{formatOdds(display.odds, oddsFormat)}</span>
              </div>
              <div className="parlay-leg-prob">{formatPercent(display.probability)}</div>
              {pickKeyAll && pickKeyTile && (
                <PropEditButton
                  pickKeyAll={pickKeyAll}
                  pickKeyTile={pickKeyTile}
                  currentLine={display.line as number}
                  currentSide={display.side as "over" | "under"}
                  currentOdds={display.odds}
                  hasEdit={display.edited}
                  activeScope={activeScope}
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
