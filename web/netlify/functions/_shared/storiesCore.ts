import { Pool } from "pg";
import { TEAMS } from "@/lib/teams";

// Same reasoning as digestCore.ts: Netlify Functions bundle
// independently from the Next.js app, so this can't import
// src/lib/db.ts ("server-only" is a Next.js-bundler-only marker) --
// a second small Pool is a far smaller duplication than re-deriving
// this file's query logic inside src/lib. teams.ts has no such marker
// (plain data, no Next.js/DB dependency), so that one's imported
// directly rather than duplicated.
let pool: Pool | undefined;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL not set");
    pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false }, max: 3 });
  }
  return pool;
}

async function query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]> {
  const result = await getPool().query(text, params);
  return result.rows as T[];
}

// Same season-year rule as predictions.ts/digestCore.ts.
export function currentSeasonYear(): number {
  const now = new Date();
  return now.getMonth() < 2 ? now.getFullYear() - 1 : now.getFullYear();
}

// Fallback for when SportsAnalytics's own sync job hasn't written a
// game's real score back to latest_predictions yet -- observed to lag
// by DAYS in practice (a whole week's worth of games can sit with
// actual_home_score still null well after they've actually been
// played). Without this, mostRecentFinalWeek()/finalGamesForWeek()
// would just never consider that week done, and no recap would ever
// get written for it.
//
// Deliberately TheSportsDB's full-season endpoint, not ESPN's
// scoreboard (which src/lib/liveScores.ts uses elsewhere) -- ESPN's
// scoreboard only ever returns "the current week," so it can't
// retroactively answer for a week that's already in the past by the
// time this runs. TheSportsDB's season archive keeps every week's
// real score regardless of how much later it's queried, same
// endpoint src/lib/schedule.ts uses for the site itself; replicated
// here rather than imported since that file is "server-only" (a
// Next.js-bundler-only marker Netlify Functions don't understand).
const NAME_TO_ALIAS = new Map(TEAMS.map((t) => [`${t.market} ${t.name}`, t.alias]));
let sportsDbCache: { season: number; expires: number; byGameId: Map<string, { home: number; away: number }> } | null =
  null;

async function theSportsDbFinalScores(season: number): Promise<Map<string, { home: number; away: number }>> {
  if (sportsDbCache && sportsDbCache.season === season && sportsDbCache.expires > Date.now()) {
    return sportsDbCache.byGameId;
  }

  const byGameId = new Map<string, { home: number; away: number }>();
  const apiKey = process.env.THESPORTSDB_API_KEY;

  if (apiKey) {
    try {
      const res = await fetch(
        `https://www.thesportsdb.com/api/v1/json/${apiKey}/eventsseason.php?id=4391&s=${season}`
      );
      if (res.ok) {
        const data = (await res.json()) as {
          events?: {
            intRound?: string;
            strHomeTeam?: string;
            strAwayTeam?: string;
            strStatus?: string;
            intHomeScore?: string | null;
            intAwayScore?: string | null;
          }[];
        };
        for (const event of data.events ?? []) {
          // "FT" (Full Time) covers a normal finish; "AOT" (After
          // Over Time) is what TheSportsDB uses for a game that went
          // to overtime -- same two statuses schedule.ts checks.
          const final = event.strStatus === "FT" || event.strStatus === "AOT";
          if (!final || event.intHomeScore == null || event.intAwayScore == null) continue;

          const round = Number(event.intRound);
          if (!Number.isFinite(round) || round < 1 || round > 18) continue; // regular season only

          const homeAlias = NAME_TO_ALIAS.get(event.strHomeTeam ?? "");
          const awayAlias = NAME_TO_ALIAS.get(event.strAwayTeam ?? "");
          if (!homeAlias || !awayAlias) continue;

          const week = String(round).padStart(2, "0");
          const universalGameId = `${season.toString().padStart(4, "0")}R${week}${awayAlias}${homeAlias}`;
          byGameId.set(universalGameId, { home: Number(event.intHomeScore), away: Number(event.intAwayScore) });
        }
      }
    } catch {
      // TheSportsDB hiccup -- caller just proceeds with whatever the
      // DB already has, same as every other external-fetch fallback
      // in this codebase.
    }
  }

  sportsDbCache = { season, expires: Date.now() + 30 * 60 * 1000, byGameId };
  return byGameId;
}

export interface FinalGame {
  universal_game_id: string;
  week: number;
  home_team: string;
  away_team: string;
  actual_home_score: number;
  actual_away_score: number;
  home_win_probability: number;
  expected_home_score: number;
  expected_away_score: number;
  market_spread_line_current: number;
  game_date: Date;
}

// Every game in `week` that has a real final score -- from the DB
// when SportsAnalytics has already written it back to
// latest_predictions, falling back to theSportsDbFinalScores()
// otherwise (see that function's comment for why the fallback exists
// at all). The DB's own number always wins when both exist; the
// fallback only ever fills a genuine gap, never overrides. Includes
// the model's own pregame projection (expected_home_score/
// expected_away_score, market_spread_line_current) alongside the real
// result specifically so a recap can talk about how the simulation
// compared to what actually happened, not just recite the final score.
export async function finalGamesForWeek(season: number, week: number): Promise<FinalGame[]> {
  const rows = await query<
    FinalGame & { actual_home_score: number | null; actual_away_score: number | null }
  >(
    `SELECT universal_game_id, week, home_team, away_team,
            actual_home_score, actual_away_score, home_win_probability,
            expected_home_score, expected_away_score, market_spread_line_current, game_date
     FROM latest_predictions
     WHERE season = $1 AND week = $2
     ORDER BY game_date ASC`,
    [season, week]
  );

  const fallback = await theSportsDbFinalScores(season);
  const finalGames: FinalGame[] = [];

  for (const row of rows) {
    if (row.actual_home_score !== null && row.actual_away_score !== null) {
      finalGames.push(row as FinalGame);
      continue;
    }
    const fromFallback = fallback.get(row.universal_game_id);
    if (fromFallback) {
      finalGames.push({ ...row, actual_home_score: fromFallback.home, actual_away_score: fromFallback.away });
    }
  }

  return finalGames;
}

// The most recent week in `season` where every game that's kicked off
// has a real final score -- i.e. "fully done," not "in progress."
// Returns null if no week that season is fully final yet (e.g. Week 1
// Sunday afternoon, before Sunday/Monday night games finish). Same
// DB-first-then-TheSportsDB-fallback reasoning as finalGamesForWeek --
// without the fallback, a week the DB sync job is behind on would
// never register as "done" here even though it demonstrably is.
export async function mostRecentFinalWeek(season: number): Promise<number | null> {
  const rows = await query<{
    week: number;
    universal_game_id: string;
    actual_home_score: number | null;
    actual_away_score: number | null;
  }>(`SELECT week, universal_game_id, actual_home_score, actual_away_score FROM latest_predictions WHERE season = $1`, [
    season,
  ]);
  if (rows.length === 0) return null;

  const fallback = await theSportsDbFinalScores(season);
  const byWeek = new Map<number, { total: number; final: number }>();

  for (const row of rows) {
    const entry = byWeek.get(row.week) ?? { total: 0, final: 0 };
    entry.total++;
    const isFinal =
      (row.actual_home_score !== null && row.actual_away_score !== null) || fallback.has(row.universal_game_id);
    if (isFinal) entry.final++;
    byWeek.set(row.week, entry);
  }

  const fullyFinal = [...byWeek.entries()].filter(([, c]) => c.total > 0 && c.final === c.total).map(([week]) => week);
  if (fullyFinal.length === 0) return null;
  return Math.max(...fullyFinal);
}

// Win/loss/tie record for `team`, counting only real-final games in
// `season` strictly before `throughWeek` -- this-season only (the
// predictions DB doesn't carry prior-season history), matching what
// the site already shows next to a team name elsewhere. Deliberately
// NOT a multi-year streak/history lookup -- that needs a real
// historical stats source, not something to approximate here.
//
// Same DB-first-then-TheSportsDB-fallback as finalGamesForWeek/
// mostRecentFinalWeek -- without it, a record computed for Week 3+
// would silently undercount any earlier game the DB sync job hasn't
// caught up on yet, which is exactly the kind of quietly-wrong stat
// this brand explicitly can't afford (see sql/010's incident note).
// Inert for Week 1 specifically (nothing to count before it), which
// is why this bug was invisible until recaps needed to reach Week 2+.
export async function teamRecordEntering(season: number, throughWeek: number, team: string): Promise<string> {
  const rows = await query<{ universal_game_id: string; is_home: boolean; team_score: number | null; opp_score: number | null }>(
    `SELECT universal_game_id, true AS is_home, actual_home_score AS team_score, actual_away_score AS opp_score
       FROM latest_predictions WHERE season = $1 AND week < $2 AND home_team = $3
     UNION ALL
     SELECT universal_game_id, false AS is_home, actual_away_score AS team_score, actual_home_score AS opp_score
       FROM latest_predictions WHERE season = $1 AND week < $2 AND away_team = $3`,
    [season, throughWeek, team]
  );
  const fallback = await theSportsDbFinalScores(season);
  let w = 0,
    l = 0,
    t = 0;
  for (const r of rows) {
    let teamScore = r.team_score;
    let oppScore = r.opp_score;
    if (teamScore === null || oppScore === null) {
      const fromFallback = fallback.get(r.universal_game_id);
      if (!fromFallback) continue;
      teamScore = r.is_home ? fromFallback.home : fromFallback.away;
      oppScore = r.is_home ? fromFallback.away : fromFallback.home;
    }
    if (teamScore > oppScore) w++;
    else if (teamScore < oppScore) l++;
    else t++;
  }
  return t > 0 ? `${w}-${l}-${t}` : `${w}-${l}`;
}

export async function storyAlreadyExists(universalGameId: string): Promise<boolean> {
  const rows = await query("SELECT 1 FROM stories WHERE universal_game_id = $1", [universalGameId]);
  return rows.length > 0;
}

export interface GameFacts {
  season: number;
  week: number;
  universal_game_id: string;
  winner: string;
  loser: string;
  winner_score: number;
  loser_score: number;
  margin: number;
  winner_pregame_win_probability: number;
  was_upset: boolean;
  winner_record_after: string;
  loser_record_after: string;
  // Added so a recap can talk about how the simulation compared to
  // what actually happened, not just recite the final score -- see
  // the module comment on generateStory for why this exists.
  winner_expected_score: number;
  loser_expected_score: number;
  expected_margin: number; // winner_expected_score - loser_expected_score; negative means the model expected the eventual LOSER to win
  market_favorite: string; // team the published betting line favored, independent of who the model favored
  market_spread: number; // points the market favorite was favored by (always positive)
}

// Every number here comes straight from real DB columns -- this is
// the ONLY input the writer prompt (weekly-stories.mts) is allowed to
// see. Nothing downstream may add a fact that isn't already present
// on this object.
export async function buildGameFacts(game: FinalGame, season: number): Promise<GameFacts> {
  const homeWon = game.actual_home_score > game.actual_away_score;
  const winner = homeWon ? game.home_team : game.away_team;
  const loser = homeWon ? game.away_team : game.home_team;
  const winnerScore = homeWon ? game.actual_home_score : game.actual_away_score;
  const loserScore = homeWon ? game.actual_away_score : game.actual_home_score;
  const winnerPregameProb = homeWon ? game.home_win_probability : 1 - game.home_win_probability;
  const winnerExpectedScore = homeWon ? game.expected_home_score : game.expected_away_score;
  const loserExpectedScore = homeWon ? game.expected_away_score : game.expected_home_score;

  // market_spread_line_current is stored "positive = good for home"
  // (see predictions.ts's SIGN CONVENTION comment) -- same sign flip
  // spreadDisplay() there uses, kept independent here since this file
  // can't import a "server-only" Next.js module (see this file's
  // header comment).
  const marketFavorite = game.market_spread_line_current >= 0 ? game.home_team : game.away_team;
  const marketSpread = Math.abs(game.market_spread_line_current);

  const [winnerRecordBefore, loserRecordBefore] = await Promise.all([
    teamRecordEntering(season, game.week, winner),
    teamRecordEntering(season, game.week, loser),
  ]);

  // "Record after" = record entering this week, plus this game's
  // result folded in by hand -- teamRecordEntering() only counts
  // strictly-before weeks, so this game's own result isn't in it yet.
  const bump = (record: string, result: "w" | "l"): string => {
    const parts = record.split("-").map(Number);
    const [w, l, t] = [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
    const next = result === "w" ? [w + 1, l, t] : [w, l + 1, t];
    return next[2] > 0 ? `${next[0]}-${next[1]}-${next[2]}` : `${next[0]}-${next[1]}`;
  };

  return {
    season,
    week: game.week,
    universal_game_id: game.universal_game_id,
    winner,
    loser,
    winner_score: winnerScore,
    loser_score: loserScore,
    margin: winnerScore - loserScore,
    winner_pregame_win_probability: Math.round(winnerPregameProb * 100) / 100,
    was_upset: winnerPregameProb < 0.5,
    winner_record_after: bump(winnerRecordBefore, "w"),
    loser_record_after: bump(loserRecordBefore, "l"),
    winner_expected_score: Math.round(winnerExpectedScore * 10) / 10,
    loser_expected_score: Math.round(loserExpectedScore * 10) / 10,
    expected_margin: Math.round((winnerExpectedScore - loserExpectedScore) * 10) / 10,
    market_favorite: marketFavorite,
    market_spread: Math.round(marketSpread * 10) / 10,
  };
}

const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";

export interface GeneratedStory {
  headline: string;
  body: string;
}

// Ships inert until ANTHROPIC_API_KEY is set (same pattern as
// AdSenseScript.tsx/GoogleAnalytics.tsx) -- the caller treats a null
// return as "skip this game, try again next run."
//
// The system prompt is deliberately restrictive: facts is a closed
// set, and the model is told explicitly not to add anything outside
// it. This exists specifically because a plausible-but-wrong stat
// (an LLM's or a radio host's) is worse for this brand than no story
// at all -- see the sql/010 migration comment for the incident this
// guards against. That guardrail matters MORE now that body is a full
// 250-300 word recap, not 2-3 sentences -- the extra length is filled
// with deeper analysis of the numbers already in `facts` (the gap
// between projected and actual score, the market line vs. the
// model's own read, what the win probability said going in), never
// with outside color commentary, trivia, or history the model wasn't
// given.
export async function generateStory(facts: GameFacts): Promise<GeneratedStory | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log("ANTHROPIC_API_KEY not set -- skipping story generation.");
    return null;
  }

  const systemPrompt = `You write game recap articles for Matrix Sports Analytics, a site whose entire brand promise is factual honesty -- it never rounds a number up or invents a stat.

You will be given a JSON object of verified facts about one NFL game, including both the real final result AND the model's own pregame projection (expected score, win probability, and the published market betting line). Write ONLY from those facts. Do not add any statistic, date, streak, record, historical claim, player name, or piece of trivia that is not present in the JSON -- if you don't have a number for something, don't mention it. Do not guess at team history, prior seasons, injuries, weather, or anything else not given to you.

The article's actual subject is the comparison between the model's simulation and what really happened -- not just a recap of the score. Structure it around: what the model projected before kickoff (expected score, win probability, and how that compared to the market's own line), what actually happened, the size of the gap between projection and result, and what that gap does or doesn't say about the model's read on this game. If the model called it correctly, say so plainly and explain by how much. If it was an upset (was_upset), say that plainly too, and use expected_margin vs the real margin to quantify how far off the projection was. Do not editorialize beyond what the numbers support -- a close miss and a blowout miss are different, so say which one this was.

Write 250-300 words. Plain, direct sentences -- this is a numbers-first analytics brand, not a radio call. No filler sentences that don't carry a fact or a comparison.

Respond with ONLY a JSON object of this exact shape, no other text: {"headline": string (under 90 chars), "body": string (250-300 words)}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 700,
      system: systemPrompt,
      messages: [{ role: "user", content: JSON.stringify(facts) }],
    }),
  });

  if (!response.ok) {
    console.error(`Anthropic API error ${response.status}: ${await response.text()}`);
    return null;
  }

  const data = (await response.json()) as { content: { type: string; text?: string }[] };
  const rawText = data.content.find((c) => c.type === "text")?.text;
  if (!rawText) return null;

  // The system prompt asks for bare JSON, but the model sometimes
  // wraps it in a ```json fence anyway -- strip one off if present
  // rather than failing the whole draft over formatting.
  const text = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  try {
    const parsed = JSON.parse(text) as GeneratedStory;
    if (typeof parsed.headline !== "string" || typeof parsed.body !== "string") return null;
    return parsed;
  } catch {
    console.error("Failed to parse model output as JSON:", text);
    return null;
  }
}

// Auto-publishes -- manual review at /admin/stories was the gate
// while the prompt was still being proven out (see the git history on
// this file for that iteration). Confirmed solid across a normal
// game, a blown-margin blowout, and a real upset, so new recaps now
// go live the moment they're generated. /admin/stories still lists
// published stories, not just drafts, specifically so a bad one can
// still be pulled after the fact -- this removed the gate, not the
// ability to moderate.
export async function insertStory(facts: GameFacts, story: GeneratedStory): Promise<void> {
  await query(
    `INSERT INTO stories (season, week, universal_game_id, headline, body, source_facts, model_used, status, published_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'published', now())
     ON CONFLICT (universal_game_id) DO NOTHING`,
    [facts.season, facts.week, facts.universal_game_id, story.headline, story.body, JSON.stringify(facts), ANTHROPIC_MODEL]
  );
}
