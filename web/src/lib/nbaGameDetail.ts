import "server-only";
import { cache } from "react";
import { query } from "@/lib/db";
import { getNbaScheduledGame, getNbaTeamRecords, etDateKey } from "@/lib/nbaSchedule";
import { getGameStarterGrades, type GameStarterGrades } from "@/lib/nbaStarterGrades";
import { getGameTeamGrades, type GameTeamGrades } from "@/lib/nbaTeamGrades";
import { getGameEfficiencyScoring, type GameEfficiencyScoring } from "@/lib/nbaEfficiencyScoring";
import { getGameFourFactors, type GameFourFactors } from "@/lib/nbaFourFactors";
import { getGameLineup, type GameLineup } from "@/lib/nbaLineup";
import { getGameShotChart, type GameShotChart } from "@/lib/nbaShotChart";
import { BANNED_US_BOOKS, NON_RETAIL_BOOKS } from "@/lib/pffBettingEdge";
import { buildGameParlays, type NbaGameParlays, type NbaParlayPick } from "@/lib/nbaParlayHelper";

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
  // Added 2026-10-27 -- NBA's own recent-form columns (src4/33, sql/012).
  // No PFF-for-basketball exists to read these off a vendor table the
  // way NFL's pffBettingEdge.ts does, so they're computed in-house --
  // see sql/012's own header for the exact shape/naming differences
  // from PFF's l5Record/l10Record pair.
  l5Avg: number | null;
  l10Avg: number | null;
  hitRateHits: number | null;
  hitRateAttempts: number;
  h2hHits: number | null;
  h2hAttempts: number;
  // Added 2026-10-31 -- sql/013, src4/40_grade_nba_player_props.py.
  // null = game not final / not graded yet (most props, since most
  // games haven't been played) -- same semantics as NFL's own
  // pick_result, read by the same PickResultIcon component.
  pickResult: string | null;
  // The player's real final value for this exact stat -- null pre-game,
  // same gating as pickResult (src4/40 sets both together). Shown next
  // to the player's name in the Betting Edge table's "Player (actual)"
  // column once the game is graded.
  actualValue: number | null;
}

// Props below this edge are hidden for now (not deleted -- still
// scored and stored) at the user's request 2026-10-27: NBA's
// projections are new enough that a low-edge pick isn't worth
// surfacing yet. Revisit once there's a real grading-loop track
// record to judge low-edge picks against, same spec step ("tune
// thresholds after 2 weeks of grading") this number should eventually
// come from instead of being hand-set.
export const MIN_DISPLAYED_EDGE = 0.1;

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
  // Same grading nbaPredictions.ts already computes for the list/
  // matchup-card view (and predictions.ts's computeCorrect() does for
  // football) -- undefined there maps to null here (no TS "optional
  // prop" on a plain data object): no score yet, or a tie. Added so
  // the single-game page can show the same yellow-check/red-X verdict
  // on the team pick that it already shows per-prop (PickResultIcon),
  // which this page never had at all -- NFL's GameDetailView.tsx has
  // had an equivalent (ResultCompare's hit/miss card) all along.
  predictionCorrect: boolean | null;
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
  // null only if nba.bbr_advanced/nba.bbr_per_game have no rows yet
  // for this game's two teams (season) -- see getGameStarterGrades.
  starterGrades: GameStarterGrades | null;
  // null only if nba.team_box_scores has no completed games yet for
  // this game's two teams (season) -- see getGameTeamGrades.
  teamGrades: GameTeamGrades | null;
  // Same null condition as teamGrades -- see getGameEfficiencyScoring.
  efficiencyScoring: GameEfficiencyScoring | null;
  // Feeds the Radar Chart view (replaced the old shot-chart mode) in
  // NbaLineupSection.tsx -- same null condition as efficiencyScoring,
  // see getGameFourFactors.
  fourFactors: GameFourFactors | null;
  // null only if nba.bbr_advanced has no rows yet for this game's two
  // teams (season) -- see getGameLineup.
  lineup: GameLineup | null;
  // null only if nba.bbr_shot_chart has no rows yet for this game's
  // two teams (season) -- see getGameShotChart.
  shotChart: GameShotChart | null;
  // Same-game parlays built from this game's top player props by pRank
  // -- backs the Parlay Helper tab, positioned after Betting Edge. Built
  // here on the server (not in the browser) from parlayPicks below, same
  // "what's built is exactly what's shown" contract pffBettingEdge.ts's
  // getGameBettingEdge follows for NFL.
  parlays: NbaGameParlays;
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
export const getNbaGameDetail = cache(async function getNbaGameDetail(
  gameId: string,
  hideBannedBooks: boolean = true
): Promise<NbaGameDetail | null> {
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

  // "latest_nba_player_prop_predictions" keeps the latest row PER DISTINCT
  // LINE VALUE, not per book's current board -- a book that quietly
  // retires an alt-line (replaced by a different number at its next
  // hourly poll) still leaves that retired line's own last-seen row
  // sitting in the view forever, looking exactly as "current" as a line
  // the book is still actually offering. Confirmed live 2026-11-02: a
  // book's board moved from a James Harden assists line of 8.5 to 6.5
  // between polls, and without this filter the page kept showing 8.5 --
  // a real line nobody could actually place anymore. Every book's props
  // for a game are written in one atomic batch (shared generated_at
  // across every row, every bookmaker, confirmed live), so "within
  // FRESHNESS_WINDOW of this book's own latest poll for this game" is a
  // reliable per-book cutoff that naturally self-adjusts for a live game
  // (keeps up with each new hourly poll) and a finished one (that book's
  // last pre-close poll just becomes its own permanent "latest," nothing
  // gets wrongly filtered out once polling for a closed game stops).
  const propRows = await query<{
    player_name: string; stat: string; line: number; side: string;
    bookmaker: string; price: number; projection: number;
    cover_probability: number; edge: number;
    l5_avg: number | null; l10_avg: number | null;
    hit_rate_hits: number | null; hit_rate_attempts: number | null;
    h2h_hits: number | null; h2h_attempts: number | null;
    pick_result: string | null; actual_value: number | null;
  }>(
    `WITH freshness AS (
       SELECT bookmaker, MAX(generated_at) AS max_gen
         FROM nba_player_prop_predictions
        WHERE universal_game_id = $1
        GROUP BY bookmaker
     )
     SELECT p.player_name, p.stat, p.line, p.side, p.bookmaker, p.price, p.projection,
            p.cover_probability, p.edge, p.l5_avg, p.l10_avg,
            p.hit_rate_hits, p.hit_rate_attempts, p.h2h_hits, p.h2h_attempts,
            p.pick_result, p.actual_value
     FROM latest_nba_player_prop_predictions p
     JOIN freshness f ON f.bookmaker = p.bookmaker
     WHERE p.universal_game_id = $1 AND p.edge >= $2 AND p.bookmaker != 'dst_propbuilder'
       AND p.generated_at >= f.max_gen - interval '15 minutes'
     ORDER BY p.cover_probability DESC`,
    [gameId, MIN_DISPLAYED_EDGE]
  );

  // Dedicated query for the Parlay Helper tab -- deliberately separate
  // from propRows above (which stays one row per bookmaker, for the
  // Betting Edge table's own line-shopping display) so this file's
  // existing, already-shipped Betting Edge query/type stays completely
  // untouched by this addition.
  //
  // "legs" collapses every bookmaker's row for the same real pick
  // (player+stat+line+side) down to ONE row, picking whichever retail,
  // non-excluded book currently pays the most (price DESC) -- same
  // line-shopping idea as parlayHelper.ts's pickBestPrice for NFL, just
  // simpler here since NBA's own props table already carries every
  // book's price directly (sql/009's header), no separate market-lines
  // join needed. A pick whose only quotes are from an excluded book
  // (non-retail, or banned-when-the-toggle-is-on) drops out of `legs`
  // entirely -- that leg has no usable price, same "skipped" outcome
  // parlayHelper.ts's bestParlay gives a book-less leg.
  //
  // "ranked" computes pRank over the FULL pool (unfiltered by book), so
  // a pick's rank reflects its true standing in this game's props
  // regardless of which book ends up quoting it.
  const excludedParlayBooks = [...NON_RETAIL_BOOKS, ...(hideBannedBooks ? BANNED_US_BOOKS : [])];
  const parlayPickRows = await query<{
    player_name: string; team: string; opponent: string; stat: string;
    line: number; side: string; projection: number; cover_probability: number;
    pick_result: string | null; actual_value: number | null;
    bookmaker: string; price: number; generated_at: Date | string;
    p_rank: string | number;
  }>(
    `WITH freshness AS (
       SELECT bookmaker, MAX(generated_at) AS max_gen
         FROM nba_player_prop_predictions
        WHERE universal_game_id = $1
        GROUP BY bookmaker
     ),
     -- Same per-book "only this book's latest poll" freshness filter as
     -- propRows above -- see that query's own comment for why. Applied
     -- here too so the Parlay Helper can't pick a retired alt-line as a
     -- leg's price, and so a retired line never even enters the pRank
     -- population in the first place (ranked/pr below).
     fresh AS (
       SELECT p.*
         FROM latest_nba_player_prop_predictions p
         JOIN freshness f ON f.bookmaker = p.bookmaker
        WHERE p.universal_game_id = $1 AND p.edge >= $2 AND p.bookmaker != 'dst_propbuilder'
          AND p.generated_at >= f.max_gen - interval '15 minutes'
     ),
     legs AS (
       SELECT DISTINCT ON (player_name, stat, line, side)
              player_name, team, opponent, stat, line, side,
              projection, cover_probability, pick_result, actual_value,
              bookmaker, price, generated_at
         FROM fresh
        WHERE bookmaker != ALL($3::text[])
        ORDER BY player_name, stat, line, side, price DESC
     ),
     ranked AS (
       SELECT player_name, stat, line, side, MAX(cover_probability) AS cover_probability
         FROM fresh
        GROUP BY player_name, stat, line, side
     ),
     pr AS (
       SELECT player_name, stat, line, side,
              ROW_NUMBER() OVER (ORDER BY cover_probability DESC) AS p_rank
         FROM ranked
     )
     SELECT legs.*, pr.p_rank
       FROM legs
       JOIN pr ON pr.player_name = legs.player_name AND pr.stat = legs.stat
              AND pr.line = legs.line AND pr.side = legs.side
      ORDER BY pr.p_rank ASC`,
    [gameId, MIN_DISPLAYED_EDGE, excludedParlayBooks]
  );
  const parlayPicks: NbaParlayPick[] = parlayPickRows.map((r) => ({
    playerName: r.player_name,
    team: r.team,
    opponent: r.opponent,
    stat: r.stat,
    line: r.line,
    side: r.side as "over" | "under",
    projection: r.projection,
    coverProbability: r.cover_probability,
    // ROW_NUMBER() comes back from pg as a string (bigint).
    pRank: r.p_rank == null ? null : Number(r.p_rank),
    pickResult: r.pick_result,
    actualValue: r.actual_value,
    bookmaker: r.bookmaker,
    price: r.price,
    oddsAsOf: r.generated_at ? new Date(r.generated_at).toISOString() : null,
    gameDay: null,
  }));
  const parlays = buildGameParlays(parlayPicks);

  const scheduled = await getNbaScheduledGame(game.home_team, game.away_team, new Date(game.game_date));
  const isFinal = Boolean(
    scheduled?.final && scheduled.actualHomeScore !== null && scheduled.actualAwayScore !== null
  );
  const isLive = Boolean(
    scheduled?.live && scheduled.actualHomeScore !== null && scheduled.actualAwayScore !== null
  );
  const hasGradableScore = (isFinal || isLive) && scheduled!.actualHomeScore !== scheduled!.actualAwayScore;
  const predictionCorrect = hasGradableScore
    ? (game.home_win_probability >= 0.5) === (scheduled!.actualHomeScore! > scheduled!.actualAwayScore!)
    : null;

  // Record entering THIS game -- see getNbaTeamRecords's own header
  // for why it can't come from the DB the way football's can.
  const records = await getNbaTeamRecords(game.season, etDateKey(new Date(game.game_date)));

  const gameDate = new Date(game.game_date);
  const [starterGrades, teamGrades, efficiencyScoring, fourFactors, lineup, shotChart] = await Promise.all([
    getGameStarterGrades(game.season, gameDate, game.home_team, game.away_team),
    getGameTeamGrades(game.season, gameDate, game.home_team, game.away_team),
    getGameEfficiencyScoring(game.season, gameDate, game.home_team, game.away_team),
    getGameFourFactors(game.season, gameDate, game.home_team, game.away_team),
    getGameLineup(game.season, gameDate, game.home_team, game.away_team),
    getGameShotChart(game.season, gameDate, game.home_team, game.away_team),
  ]);

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
    predictionCorrect,
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
      l5Avg: r.l5_avg,
      l10Avg: r.l10_avg,
      hitRateHits: r.hit_rate_hits,
      hitRateAttempts: r.hit_rate_attempts ?? 0,
      h2hHits: r.h2h_hits,
      h2hAttempts: r.h2h_attempts ?? 0,
      pickResult: r.pick_result,
      actualValue: r.actual_value,
    })),
    starterGrades,
    teamGrades,
    efficiencyScoring,
    fourFactors,
    lineup,
    shotChart,
    parlays,
  };
});
