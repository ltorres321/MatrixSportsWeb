import { Pool } from "pg";

// Same reasoning as storiesCore.ts/digestCore.ts's own Pool: Netlify
// Functions bundle independently from the Next.js app, so this can't
// import src/lib/db.ts ("server-only" is a Next.js-bundler-only
// marker) -- a second small Pool is a far smaller duplication than
// re-deriving this file's query logic inside src/lib.
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

export function currentSeasonYear(): number {
  const now = new Date();
  return now.getMonth() < 2 ? now.getFullYear() - 1 : now.getFullYear();
}

export async function currentNbaSeason(): Promise<number | null> {
  const rows = await query<{ season: number }>("SELECT MAX(season) AS season FROM latest_nba_predictions");
  return rows[0]?.season ?? null;
}

interface ConfidenceRecord {
  wins: number;
  losses: number;
}

// Same exact filter as src/lib/predictions.ts's getConfidenceRecord /
// src/lib/nbaPredictions.ts's getNbaConfidenceRecord -- this is the
// one place that actually computes it; those two now just read the
// row this writes (see each one's own comment on the cache-then-
// live-fallback order).
async function computeConfidenceRecord(
  table: "latest_predictions" | "latest_nba_predictions",
  season: number,
  minProb: number
): Promise<ConfidenceRecord> {
  const rows = await query<{ correct: string; incorrect: string }>(
    `SELECT
       COUNT(*) FILTER (WHERE pick_correct) AS correct,
       COUNT(*) FILTER (WHERE NOT pick_correct) AS incorrect
     FROM (
       SELECT
         CASE WHEN home_win_probability >= 0.5 THEN home_win_probability ELSE 1 - home_win_probability END AS pick_prob,
         CASE WHEN home_win_probability >= 0.5 THEN (actual_home_score > actual_away_score)
              ELSE (actual_away_score > actual_home_score) END AS pick_correct
       FROM ${table}
       WHERE season = $1 AND actual_home_score IS NOT NULL AND actual_away_score IS NOT NULL
         AND actual_home_score <> actual_away_score
     ) t
     WHERE pick_prob >= $2`,
    [season, minProb]
  );
  const row = rows[0];
  return { wins: row ? Number(row.correct) : 0, losses: row ? Number(row.incorrect) : 0 };
}

export async function refreshConfidenceRecordCache(): Promise<{ league: string; season: number; minProb: number; wins: number; losses: number }[]> {
  const nflSeason = currentSeasonYear();
  const nbaSeason = await currentNbaSeason();

  const jobs: { league: "nfl" | "nba"; season: number; minProb: number }[] = [
    { league: "nfl", season: nflSeason, minProb: 0.7 },
    { league: "nfl", season: nflSeason, minProb: 0.8 },
  ];
  if (nbaSeason !== null) {
    jobs.push({ league: "nba", season: nbaSeason, minProb: 0.7 }, { league: "nba", season: nbaSeason, minProb: 0.8 });
  }

  const results = [];
  for (const job of jobs) {
    const table = job.league === "nfl" ? "latest_predictions" : "latest_nba_predictions";
    const record = await computeConfidenceRecord(table, job.season, job.minProb);
    await query(
      `INSERT INTO confidence_record_cache (league, season, min_prob, wins, losses, computed_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (league, season, min_prob)
       DO UPDATE SET wins = EXCLUDED.wins, losses = EXCLUDED.losses, computed_at = now()`,
      [job.league, job.season, job.minProb, record.wins, record.losses]
    );
    results.push({ ...job, ...record });
  }
  return results;
}
