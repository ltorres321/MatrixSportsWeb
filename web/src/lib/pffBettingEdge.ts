import "server-only";
import { query } from "@/lib/db";

// Read layer over the four tables SportsPipelines/sql/010-013 added
// (etl.pff_best_bets, pff_first_touchdown, pff_player_props,
// pff_key_insights) -- backs the site's "Betting Edge" tab, positioned
// after "Matchups" on the game detail page. Same "server-only, plain
// SELECT, typed row mapper" convention as pffGameReport.ts/lineup.ts.
//
// All four source tables are keyed by universal_game_id directly (not
// season+home+away like the other PFF read layers), so every query
// here takes just that one id.
//
// ALL FOUR TABLES ARE MANUALLY FED -- see SportsPipelines/pff_api/
// pff_betting_common.py's module docstring. A game with none of this
// data yet (the Windows pipeline hasn't been run, or hasn't covered
// this week) just returns null from getGameBettingEdge -- not an
// error, same as every other optional PFF section on this page.

// ----------------------------------------------------------------------
// Game Lines (etl.pff_best_bets)
// ----------------------------------------------------------------------

export interface BestGameBetMarket {
  propType: string;
  line: number | null;
  sideOneType: string;
  sideOneOdds: number;
  sideOneEdgePct: number;
  sideOneCashPct: number | null;
  sideOneTicketsPct: number | null;
  sideTwoType: string;
  sideTwoOdds: number;
  sideTwoEdgePct: number;
  sideTwoCashPct: number | null;
  sideTwoTicketsPct: number | null;
}

interface BestGameBetRow {
  prop_type: string;
  line: number | null;
  side_one_type: string;
  side_one_odds: number;
  side_one_edge_pct: number;
  side_one_cash_pct: number | null;
  side_one_tickets_pct: number | null;
  side_two_type: string;
  side_two_odds: number;
  side_two_edge_pct: number;
  side_two_cash_pct: number | null;
  side_two_tickets_pct: number | null;
}

// PFF's own display order (spread, moneyline, total) -- the table has
// no natural numeric sort column for this, so it's spelled out here
// rather than relying on insertion order.
const PROP_TYPE_ORDER: Record<string, number> = {
  game_away_home_spread: 0,
  game_away_home_win: 1,
  game_point_total: 2,
};

// ----------------------------------------------------------------------
// First Touchdown (etl.pff_first_touchdown)
// ----------------------------------------------------------------------

export interface FirstTouchdownEntry {
  playerName: string;
  playerTeam: string;
  opponentTeam: string;
  espnId: string | null;
  sportsbook: string;
  firstTdOdds: number;
  epaPerPlay: number | null;
  oppOffEpaPerPlay: number | null;
  epaDifference: number | null;
  touches: number | null;
  touchRatePct: number | null;
  adjTargetRatePct: number | null;
  redZoneCarries: number | null;
  redZoneTargets: number | null;
  tdRateAllowedPct: number | null;
}

interface FirstTouchdownRow {
  player_name: string;
  player_team: string;
  opponent_team: string;
  espn_id: string | null;
  sportsbook: string;
  first_td_odds: number;
  epa_per_play: number | null;
  opp_off_epa_per_play: number | null;
  epa_difference: number | null;
  touches: number | null;
  touch_rate_pct: number | null;
  adj_target_rate_pct: number | null;
  red_zone_carries: number | null;
  red_zone_targets: number | null;
  td_rate_allowed_pct: number | null;
}

// ----------------------------------------------------------------------
// Player Props (etl.pff_player_props)
// ----------------------------------------------------------------------

export interface PlayerPropEntry {
  playerName: string;
  playerTeam: string;
  opponentTeam: string;
  espnId: string | null;
  consensusStat: string;
  consensusLine: number | null;
  pickSportsbook: string | null;
  pickSide: string | null;
  pickLine: number | null;
  pickOdds: number | null;
  projValue: number | null;
  projDirection: string | null;
  l10Avg: number | null;
  covProbPct: number | null;
  edgePct: number | null;
  defVsPropRank: string | null;
  matchupGrade: string | null;
  matchupPosition: string | null;
  simDefRecord: string | null;
  simDefHitType: string | null;
  l5Record: string | null;
  l5HitType: string | null;
  l10Record: string | null;
  l10HitType: string | null;
  h2hRecord: string | null;
  h2hHitType: string | null;
}

interface PlayerPropRow {
  player_name: string;
  player_team: string;
  opponent_team: string;
  espn_id: string | null;
  consensus_stat: string;
  consensus_line: number | null;
  pick_sportsbook: string | null;
  pick_side: string | null;
  pick_line: number | null;
  pick_odds: number | null;
  proj_value: number | null;
  proj_direction: string | null;
  l10_avg: number | null;
  cov_prob_pct: number | null;
  edge_pct: number | null;
  def_vs_prop_rank: string | null;
  matchup_grade: string | null;
  matchup_position: string | null;
  sim_def_record: string | null;
  sim_def_hit_type: string | null;
  l5_record: string | null;
  l5_hit_type: string | null;
  l10_record: string | null;
  l10_hit_type: string | null;
  h2h_record: string | null;
  h2h_hit_type: string | null;
}

// ----------------------------------------------------------------------
// Key Insights (etl.pff_key_insights)
// ----------------------------------------------------------------------

export interface KeyInsightEntry {
  playerName: string;
  position: string | null;
  playerTeam: string;
  opponentTeam: string;
  insightHeadline: string;
  insightDetail: string;
  headshotUrl: string | null;
}

interface KeyInsightRow {
  player_name: string;
  position: string | null;
  player_team: string;
  opponent_team: string;
  insight_headline: string;
  insight_detail: string;
  headshot_url: string | null;
}

// ----------------------------------------------------------------------

export interface GameBettingEdge {
  bestGameBets: BestGameBetMarket[];
  firstTouchdown: FirstTouchdownEntry[];
  keyInsights: KeyInsightEntry[];
  playerProps: PlayerPropEntry[];
}

export async function getGameBettingEdge(universalGameId: string): Promise<GameBettingEdge | null> {
  const [bestGameBetRows, firstTouchdownRows, playerPropRows, keyInsightRows] = await Promise.all([
    query<BestGameBetRow>(
      `SELECT prop_type, line, side_one_type, side_one_odds, side_one_edge_pct,
              side_one_cash_pct, side_one_tickets_pct, side_two_type, side_two_odds,
              side_two_edge_pct, side_two_cash_pct, side_two_tickets_pct
       FROM etl.pff_best_bets WHERE universal_game_id = $1`,
      [universalGameId]
    ),
    query<FirstTouchdownRow>(
      `SELECT ft.player_name, ft.player_team, ft.opponent_team, lu.espn_id, ft.sportsbook,
              ft.first_td_odds, ft.epa_per_play, ft.opp_off_epa_per_play, ft.epa_difference,
              ft.touches, ft.touch_rate_pct, ft.adj_target_rate_pct, ft.red_zone_carries,
              ft.red_zone_targets, ft.td_rate_allowed_pct
       FROM etl.pff_first_touchdown ft
       -- Same LATERAL + LIMIT 1 pattern as the player-props query below
       -- -- see that one's own comment for why.
       LEFT JOIN LATERAL (
         SELECT espn_id FROM etl.pff_lineup
         WHERE player_name = ft.player_name AND season = ft.season
         LIMIT 1
       ) lu ON true
       WHERE ft.universal_game_id = $1 ORDER BY ft.first_td_odds ASC`,
      [universalGameId]
    ),
    query<PlayerPropRow>(
      `SELECT pp.player_name, pp.player_team, pp.opponent_team, lu.espn_id, pp.consensus_stat,
              pp.consensus_line, pp.pick_sportsbook, pp.pick_side, pp.pick_line, pp.pick_odds,
              pp.proj_value, pp.proj_direction, pp.l10_avg, pp.cov_prob_pct, pp.edge_pct,
              pp.def_vs_prop_rank, pp.matchup_grade, pp.matchup_position, pp.sim_def_record,
              pp.sim_def_hit_type, pp.l5_record, pp.l5_hit_type, pp.l10_record, pp.l10_hit_type,
              pp.h2h_record, pp.h2h_hit_type
       FROM etl.pff_player_props pp
       -- LATERAL + LIMIT 1, not a plain JOIN: etl.pff_player_props has
       -- no player id of its own to join on, only a name, and a plain
       -- join could duplicate a prop row if pff_lineup ever had more
       -- than one match for that name/season (a Jr./Sr. collision,
       -- say) -- this guarantees at most one espn_id per prop row
       -- regardless, same safety property poll_key_insights.py's own
       -- name-based lookup relies on, just enforced in SQL here.
       LEFT JOIN LATERAL (
         SELECT espn_id FROM etl.pff_lineup
         WHERE player_name = pp.player_name AND season = pp.season
         LIMIT 1
       ) lu ON true
       WHERE pp.universal_game_id = $1
       ORDER BY pp.edge_pct DESC NULLS LAST`,
      [universalGameId]
    ),
    query<KeyInsightRow>(
      `SELECT player_name, position, player_team, opponent_team, insight_headline,
              insight_detail, headshot_url
       FROM etl.pff_key_insights WHERE universal_game_id = $1 ORDER BY player_name`,
      [universalGameId]
    ),
  ]);

  if (
    bestGameBetRows.length === 0 &&
    firstTouchdownRows.length === 0 &&
    playerPropRows.length === 0 &&
    keyInsightRows.length === 0
  ) {
    return null;
  }

  const bestGameBets: BestGameBetMarket[] = bestGameBetRows
    .map((r) => ({
      propType: r.prop_type,
      line: r.line,
      sideOneType: r.side_one_type,
      sideOneOdds: r.side_one_odds,
      sideOneEdgePct: r.side_one_edge_pct,
      sideOneCashPct: r.side_one_cash_pct,
      sideOneTicketsPct: r.side_one_tickets_pct,
      sideTwoType: r.side_two_type,
      sideTwoOdds: r.side_two_odds,
      sideTwoEdgePct: r.side_two_edge_pct,
      sideTwoCashPct: r.side_two_cash_pct,
      sideTwoTicketsPct: r.side_two_tickets_pct,
    }))
    .sort((a, b) => (PROP_TYPE_ORDER[a.propType] ?? 99) - (PROP_TYPE_ORDER[b.propType] ?? 99));

  const firstTouchdown: FirstTouchdownEntry[] = firstTouchdownRows.map((r) => ({
    playerName: r.player_name,
    playerTeam: r.player_team,
    opponentTeam: r.opponent_team,
    espnId: r.espn_id,
    sportsbook: r.sportsbook,
    firstTdOdds: r.first_td_odds,
    epaPerPlay: r.epa_per_play,
    oppOffEpaPerPlay: r.opp_off_epa_per_play,
    epaDifference: r.epa_difference,
    touches: r.touches,
    touchRatePct: r.touch_rate_pct,
    adjTargetRatePct: r.adj_target_rate_pct,
    redZoneCarries: r.red_zone_carries,
    redZoneTargets: r.red_zone_targets,
    tdRateAllowedPct: r.td_rate_allowed_pct,
  }));

  const playerProps: PlayerPropEntry[] = playerPropRows.map((r) => ({
    playerName: r.player_name,
    playerTeam: r.player_team,
    opponentTeam: r.opponent_team,
    espnId: r.espn_id,
    consensusStat: r.consensus_stat,
    consensusLine: r.consensus_line,
    pickSportsbook: r.pick_sportsbook,
    pickSide: r.pick_side,
    pickLine: r.pick_line,
    pickOdds: r.pick_odds,
    projValue: r.proj_value,
    projDirection: r.proj_direction,
    l10Avg: r.l10_avg,
    covProbPct: r.cov_prob_pct,
    edgePct: r.edge_pct,
    defVsPropRank: r.def_vs_prop_rank,
    matchupGrade: r.matchup_grade,
    matchupPosition: r.matchup_position,
    simDefRecord: r.sim_def_record,
    simDefHitType: r.sim_def_hit_type,
    l5Record: r.l5_record,
    l5HitType: r.l5_hit_type,
    l10Record: r.l10_record,
    l10HitType: r.l10_hit_type,
    h2hRecord: r.h2h_record,
    h2hHitType: r.h2h_hit_type,
  }));

  const keyInsights: KeyInsightEntry[] = keyInsightRows.map((r) => ({
    playerName: r.player_name,
    position: r.position,
    playerTeam: r.player_team,
    opponentTeam: r.opponent_team,
    insightHeadline: r.insight_headline,
    insightDetail: r.insight_detail,
    headshotUrl: r.headshot_url,
  }));

  return { bestGameBets, firstTouchdown, keyInsights, playerProps };
}
