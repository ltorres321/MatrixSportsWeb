import "server-only";
import { Pool } from "pg";

// Direct Postgres connection to the same Supabase database Supabase
// Auth lives in -- mirrors the project's Python db.py exactly. This
// app only ever SELECTs against predictions/latest_predictions;
// SportsAnalytics (a separate repo) owns every INSERT into those. The
// "server-only" import above makes it a build error to ever pull this
// into a "use client" file or the browser bundle.
//
// One pool for the life of the server process (not one connection per
// request like Python's short-lived-connection db.py) -- Next.js
// keeps a long-running Node process, so a pool is the natural fit;
// `max` caps it well under Supabase's connection limit.
let pool: Pool | undefined;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL not set -- check .env.local");
    }
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 5,
    });
  }
  return pool;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await getPool().query(text, params);
  return result.rows as T[];
}
