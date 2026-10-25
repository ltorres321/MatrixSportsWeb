import "server-only";
import { cache } from "react";
import { query } from "@/lib/db";
import { getNbaScheduledGame, getNbaTeamRecords, etDateKey } from "@/lib/nbaSchedule";

// NBA equivalent of predictions.ts's getGameDetail(), scoped to just
// what src4 actually produces: the matchup (nba_predictions), real
// scored player props (nba_player_prop_predictions -- see
// src4/33_predict_live_player_props.py), and live injury status
// (nba_injuries).
//
// MARGIN-OF-VICTORY / TOTALS ARE NOW REAL (src4/34 + src4/26's Monte
// Carlo) -- these used to be permanently-null placeholders ("not
// calculated yet") because there was no NBA Monte Carlo engine at
// all.
//
// REAL MARKET LINE, SOMETIMES: as of 2026-10-25, SportsPipelines'
// prop_lines/poll_propline_nba_market_lines.py polls real pregame NBA
// spread/total lines into etl.nba_market_lines -- src4/26 centers the
// simulation on that real line when one exists for a game (not every
// game has one yet; lines post closer to tipoff, same "props post
// late" pattern already seen for player props), falling back to its
// own regression prediction otherwise. odds_source on each row records
// which happened ('propline_market' | 'model_regression') --
// marketSpread/marketTotal below are null exactly when odds_source is
// 'model_regression', a real "no market line yet" case, not a
// permanent gap.

export interface NbaInjuryEntry {
  playerName: string;
  status: string;
  comment: string | null;
}

// Fixed reference points for the Totals section, same role as
// football's [30,40,44,48,52] -- NOW the same six values src4/26
// actually computes total_over_*/total_under_* at (checked against
// the real 2023-2026 total_points distribution: mean 229, 5th/95th
// percentile 197/262 -- see src4/FINDINGS.md). Changing this array
// without changing src4/26's TOTAL_THRESHOLDS would silently break
// the mapping below.
export const NBA_TOTAL_LINES = [210, 220, 230, 240, 250, 260];

export interface NbaPropEdge {
  playerName: string;
  stat: string;
  line: number;
  side: "over" | "under";
  bookmaker: string;
  price: number;
  projection: number;
  coverProbability: number;
  edge: number;
}

export interface NbaMarginBucket {
  label: string;
  pct: number | null; // null only for a row predating sql/010 (no simulation run yet)
}

export interface NbaTotalLine {
  line: number;
  over: number | null;
  under: number | null;
  // True for whichever fixed line sits closest to this game's own
  // expectedTotal. That's a REAL market line when
  // NbaGameDetail.oddsSource === 'propline_market' -- check that
  // field to label this correctly (don't assume "isMarketLine: true"
  // alone means a real sportsbook number; see module header).
  isMarketLine: boolean;
}

export interface NbaGameDetail {
  id: string;
  season: number;
  gameDate: string;
  kickoff: string;
  homeTeam: string;
  homeTeamName: string;
  homeRecord: string;
  awayTeam: string;
  awayTeamName: string;
  awayRecord: string;
  homeWinProbability: number;
  // Real score (final OR currently in progress -- see isLive) from
  // TheSportsDB's live feed, falling back to its season results feed
  // once a game ages off the live one (nbaSchedule.ts), unlike the
  // model-only fields right after this one.
  actualHomeScore: number | null;
  actualAwayScore: number | null;
  isFinal: boolean;
  isLive: boolean;
  livePeriod: string | null; // e.g. "3rd Quarter" -- null unless isLive
  // 'propline_market' (real polled line) | 'model_regression'
  // (fallback) | null (row predates sql/011). Check this, not just
  // whether marketSpread/marketTotal happen to be non-null, to label
  // the UI correctly -- see module header.
  oddsSource: string | null;
  // Real when oddsSource === 'propline_market', null otherwise.
  marketSpread: string | null;
  marketTotal: string | null;
  expectedHomeScore: number | null;
  expectedAwayScore: number | null;
  marginBuckets: NbaMarginBucket[];
  totals: NbaTotalLine[];
  injuriesHome: NbaInjuryEntry[];
  injuriesAway: NbaInjuryEntry[];
  props: NbaPropEdge[];
}

interface GameRow {
  universal_game_id: string;
  season: number;
  home_team: string;
  home_team_name: string;
  away_team: string;
  away_team_name: string;
  game_date: Date;
  home_win_probability: number;
  expected_home_score: number | null;
  expected_away_score: number | null;
  market_spread_line_current: number | null;
  market_total_line_current: number | null;
  odds_source: string | null;
  margin_bucket_lost_or_tied: number | null;
  margin_bucket_won_1_3: number | null;
  margin_bucket_won_4_7: number | null;
  margin_bucket_won_8_14: number | null;
  margin_bucket_won_15_21: number | null;
  margin_bucket_won_21_plus: number | null;
  total_over_210: number | null;
  total_over_220: number | null;
  total_over_230: number | null;
  total_over_240: number | null;
  total_over_250: number | null;
  total_over_260: number | null;
  total_under_210: number | null;
  total_under_220: number | null;
  total_under_230: number | null;
  total_under_240: number | null;
  total_under_250: number | null;
  total_under_260: number | null;
}

// null stays null (no simulation run yet, e.g. a row inserted before
// sql/010 existed) rather than being displayed as a fabricated 0%.
function pctOf(probability: number | null): number | null {
  return probability === null ? null : Math.round(probability * 100);
}

// Same format as predictions.ts's spreadDisplay for football:
// "<favored team> -<abs spread>". spread here is already in this
// project's positive-favors-home convention (src4/26 flips
// PropLine's raw home-signed point the same way serving/4 flips
// the_odds_api's).
function spreadDisplay(spread: number, homeTeamName: string, awayTeamName: string): string {
  const favored = spread >= 0 ? homeTeamName : awayTeamName;
  return `${favored} -${Math.abs(spread).toFixed(1)}`;
}

// Wrapped in cache() for the same reason predictions.ts's
// getGameDetail is: page.tsx calls this once in generateMetadata and
// again in the page body on every /nba/game/[id] view, and this does
// 4 sequential/parallel DB round trips (the prediction row, injuries,
// props, schedule/records) -- without this, every view paid that cost
// twice.
export const getNbaGameDetail = cache(async function getNbaGameDetail(gameId: string): Promise<NbaGameDetail | null> {
  const games = await query<GameRow>(
    `SELECT universal_game_id, season, home_team, home_team_name,
            away_team, away_team_name, game_date, home_win_probability,
            expected_home_score, expected_away_score,
            market_spread_line_current, market_total_line_current, odds_source,
            margin_bucket_lost_or_tied, margin_bucket_won_1_3, margin_bucket_won_4_7,
            margin_bucket_won_8_14, margin_bucket_won_15_21, margin_bucket_won_21_plus,
            total_over_210, total_over_220, total_over_230, total_over_240,
            total_over_250, total_over_260,
            total_under_210, total_under_220, total_under_230, total_under_240,
            total_under_250, total_under_260
     FROM latest_nba_predictions WHERE universal_game_id = $1`,
    [gameId]
  );
  const game = games[0];
  if (!game) return null;

  const injuryRows = await query<{ player_name: string; status: string; short_comment: string | null; team: string }>(
    `SELECT player_name, status, short_comment, team FROM nba_injuries
     WHERE team = $1 OR team = $2`,
    [game.home_team_name, game.away_team_name]
  );

  const propRows = await query<{
    player_name: string; stat: string; line: number; side: string;
    bookmaker: string; price: number; projection: number;
    cover_probability: number; edge: number;
  }>(
    `SELECT player_name, stat, line, side, bookmaker, price, projection,
            cover_probability, edge
     FROM latest_nba_player_prop_predictions
     WHERE universal_game_id = $1
     ORDER BY edge DESC`,
    [gameId]
  );

  const scheduled = await getNbaScheduledGame(game.home_team, game.away_team, new Date(game.game_date));
  const isFinal = Boolean(
    scheduled?.final && scheduled.actualHomeScore !== null && scheduled.actualAwayScore !== null
  );
  const isLive = Boolean(
    scheduled?.live && scheduled.actualHomeScore !== null && scheduled.actualAwayScore !== null
  );

  // Record entering THIS game -- see getNbaTeamRecords's own header
  // for why it can't come from the DB the way football's can.
  const records = await getNbaTeamRecords(game.season, etDateKey(new Date(game.game_date)));

  const gameDate = new Date(game.game_date);
  const kickoff =
    new Intl.DateTimeFormat("en-US", {
      weekday: "short", hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
    }).format(gameDate) + " ET";

  const toEntry = (r: { player_name: string; status: string; short_comment: string | null }) => ({
    playerName: r.player_name,
    status: r.status,
    comment: r.short_comment,
  });

  const marginBuckets: NbaMarginBucket[] = [
    { label: "Lost / Tied", pct: pctOf(game.margin_bucket_lost_or_tied) },
    { label: "Won by 1-3", pct: pctOf(game.margin_bucket_won_1_3) },
    { label: "Won by 4-7", pct: pctOf(game.margin_bucket_won_4_7) },
    { label: "Won by 8-14", pct: pctOf(game.margin_bucket_won_8_14) },
    { label: "Won by 15-21", pct: pctOf(game.margin_bucket_won_15_21) },
    { label: "Won by 21+", pct: pctOf(game.margin_bucket_won_21_plus) },
  ];

  // isMarketLine flags whichever fixed line sits closest to the real
  // market total when one exists (odds_source 'propline_market'), or
  // to this game's own expected total otherwise (the model's own
  // pick) -- see module header and NbaTotalLine's own comment for why
  // the view layer must check oddsSource, not just isMarketLine, to
  // label this correctly.
  const referenceTotal =
    game.odds_source === "propline_market" && game.market_total_line_current !== null
      ? game.market_total_line_current
      : game.expected_home_score !== null && game.expected_away_score !== null
      ? game.expected_home_score + game.expected_away_score
      : null;
  const totalOverUnder: Record<number, [number | null, number | null]> = {
    210: [game.total_over_210, game.total_under_210],
    220: [game.total_over_220, game.total_under_220],
    230: [game.total_over_230, game.total_under_230],
    240: [game.total_over_240, game.total_under_240],
    250: [game.total_over_250, game.total_under_250],
    260: [game.total_over_260, game.total_under_260],
  };
  const closestLine =
    referenceTotal === null
      ? null
      : NBA_TOTAL_LINES.reduce((closest, line) =>
          Math.abs(line - referenceTotal) < Math.abs(closest - referenceTotal) ? line : closest
        );
  const totals: NbaTotalLine[] = NBA_TOTAL_LINES.map((line) => {
    const [over, under] = totalOverUnder[line];
    return { line, over: pctOf(over), under: pctOf(under), isMarketLine: line === closestLine };
  });

  return {
    id: game.universal_game_id,
    season: game.season,
    gameDate: gameDate.toISOString(),
    kickoff,
    homeTeam: game.home_team,
    homeTeamName: game.home_team_name,
    homeRecord: records.get(game.home_team) ?? "0-0",
    awayTeam: game.away_team,
    awayTeamName: game.away_team_name,
    awayRecord: records.get(game.away_team) ?? "0-0",
    homeWinProbability: game.home_win_probability,
    actualHomeScore: isFinal || isLive ? scheduled!.actualHomeScore : null,
    actualAwayScore: isFinal || isLive ? scheduled!.actualAwayScore : null,
    isFinal,
    isLive,
    livePeriod: isLive ? scheduled!.period : null,
    oddsSource: game.odds_source,
    marketSpread:
      game.odds_source === "propline_market" && game.market_spread_line_current !== null
        ? spreadDisplay(game.market_spread_line_current, game.home_team_name, game.away_team_name)
        : null,
    marketTotal:
      game.odds_source === "propline_market" && game.market_total_line_current !== null
        ? game.market_total_line_current.toFixed(1)
        : null,
    expectedHomeScore: game.expected_home_score,
    expectedAwayScore: game.expected_away_score,
    marginBuckets,
    totals,
    injuriesHome: injuryRows.filter((r) => r.team === game.home_team_name).map(toEntry),
    injuriesAway: injuryRows.filter((r) => r.team === game.away_team_name).map(toEntry),
    props: propRows.map((r) => ({
      playerName: r.player_name,
      stat: r.stat,
      line: r.line,
      side: r.side as "over" | "under",
      bookmaker: r.bookmaker,
      price: r.price,
      projection: r.projection,
      coverProbability: r.cover_probability,
      edge: r.edge,
    })),
  };
});
