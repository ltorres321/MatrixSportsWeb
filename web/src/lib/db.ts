import "server-only";
import { Pool } from "pg";

// Direct Postgres connection to the same Supabase database Supabase
// Auth lives in -- mirrors the project's Python db.py exactly. This
// app only ever SELECTs against predictions/latest_predictions;
// SportsAnalytics (a separate repo) owns every INSERT into those. The
// "server-only" import above makes it a build error to ever pull this
// into a "use client" file or the browser bundle.
//
// `max: 1` and short timeouts are deliberate for Netlify Functions
// (serverless): every function instance gets its OWN copy of this
// module-level `pool`, so a larger per-instance pool just multiplies
// how many of Supabase's own pooler (Supavisor, running in
// Transaction mode) connection slots a single burst of concurrent
// instances can hold -- that's what produced the "unable to check
// out connection from the pool ... in Transaction mode" errors seen
// on a low-traffic branch deploy (frequent cold starts, each wanting
// its own batch of connections). Supavisor already multiplexes many
// clients onto few real Postgres connections; the client-side pool
// here only needs to cover one request at a time per instance.
let pool: Pool | undefined;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL not set -- check .env.local");
    }
    const newPool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 1,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    });
    // pg's Pool emits 'error' on a problem with an already-idle client
    // (e.g. Supavisor dropping a connection a frozen/thawed function
    // instance was still holding) -- left unhandled, that crashes the
    // whole Node process per pg's own docs, taking every in-flight
    // request in that instance down with it. Dropping the pool here
    // just means the next call builds a fresh one instead.
    newPool.on("error", (err) => {
      console.error("Postgres pool error on idle client:", err);
      pool = undefined;
    });
    pool = newPool;
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
