import { Pool } from "pg";

// Same reasoning as digestCore.ts: Netlify Functions bundle
// independently from the Next.js app, so this can't import
// src/lib/db.ts ("server-only" is a Next.js-bundler-only marker) --
// a second small Pool is a far smaller duplication than re-deriving
// this file's query logic inside src/lib.
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

export interface FinalGame {
  universal_game_id: string;
  week: number;
  home_team: string;
  away_team: string;
  actual_home_score: number;
  actual_away_score: number;
  home_win_probability: number;
  game_date: Date;
}

// Every game in `week` that has a real final score already recorded --
// nothing here is inferred or estimated, only what SportsAnalytics has
// actually written back to latest_predictions.
export async function finalGamesForWeek(season: number, week: number): Promise<FinalGame[]> {
  return query<FinalGame>(
    `SELECT universal_game_id, week, home_team, away_team,
            actual_home_score, actual_away_score, home_win_probability, game_date
     FROM latest_predictions
     WHERE season = $1 AND week = $2 AND actual_home_score IS NOT NULL AND actual_away_score IS NOT NULL
     ORDER BY game_date ASC`,
    [season, week]
  );
}

// The most recent week in `season` where every game that's kicked off
// has a real final score -- i.e. "fully done," not "in progress."
// Returns null if no week that season is fully final yet (e.g. Week 1
// Sunday afternoon, before Sunday/Monday night games finish).
export async function mostRecentFinalWeek(season: number): Promise<number | null> {
  const rows = await query<{ week: number; total: string; final_count: string }>(
    `SELECT week, COUNT(*) AS total, COUNT(actual_home_score) AS final_count
     FROM latest_predictions WHERE season = $1 GROUP BY week`,
    [season]
  );
  const fullyFinal = rows
    .filter((r) => Number(r.total) > 0 && Number(r.final_count) === Number(r.total))
    .map((r) => r.week);
  if (fullyFinal.length === 0) return null;
  return Math.max(...fullyFinal);
}

// Win/loss/tie record for `team`, counting only real-final games in
// `season` strictly before `throughWeek` -- this-season only (the
// predictions DB doesn't carry prior-season history), matching what
// the site already shows next to a team name elsewhere. Deliberately
// NOT a multi-year streak/history lookup -- that needs a real
// historical stats source, not something to approximate here.
export async function teamRecordEntering(season: number, throughWeek: number, team: string): Promise<string> {
  const rows = await query<{ team_score: number; opp_score: number }>(
    `SELECT actual_home_score AS team_score, actual_away_score AS opp_score
       FROM latest_predictions
       WHERE season = $1 AND week < $2 AND home_team = $3 AND actual_home_score IS NOT NULL
     UNION ALL
     SELECT actual_away_score AS team_score, actual_home_score AS opp_score
       FROM latest_predictions
       WHERE season = $1 AND week < $2 AND away_team = $3 AND actual_home_score IS NOT NULL`,
    [season, throughWeek, team]
  );
  let w = 0,
    l = 0,
    t = 0;
  for (const r of rows) {
    if (r.team_score > r.opp_score) w++;
    else if (r.team_score < r.opp_score) l++;
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
// guards against.
export async function generateStory(facts: GameFacts): Promise<GeneratedStory | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log("ANTHROPIC_API_KEY not set -- skipping story generation.");
    return null;
  }

  const systemPrompt = `You write short, punchy sports story blurbs for Matrix Sports Analytics, a site whose entire brand promise is factual honesty -- it never rounds a number up or invents a stat.

You will be given a JSON object of verified facts about one NFL game. Write ONLY from those facts. Do not add any statistic, date, streak, record, or historical claim that is not present in the JSON -- if you don't have a number for something, don't mention it. Do not guess at team history, prior seasons, or trivia not given to you.

Respond with ONLY a JSON object of this exact shape, no other text: {"headline": string (under 90 chars), "body": string (2-3 sentences)}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 300,
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

export async function insertDraftStory(facts: GameFacts, story: GeneratedStory): Promise<void> {
  await query(
    `INSERT INTO stories (season, week, universal_game_id, headline, body, source_facts, model_used, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft')
     ON CONFLICT (universal_game_id) DO NOTHING`,
    [facts.season, facts.week, facts.universal_game_id, story.headline, story.body, JSON.stringify(facts), ANTHROPIC_MODEL]
  );
}
