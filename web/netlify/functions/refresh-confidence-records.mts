// Refreshes confidence_record_cache (sql/016_confidence_record_cache.sql)
// -- the home dashboard's "Record for NFL/NBA games when model predicts
// 70%+/80%+" tiles read this table instead of recomputing the aggregate
// on every page load (user, 2026-11-09: "these records should not
// change too often so these games should be stored in a table for fast
// access"). Hourly is overkill for how often a new game actually gets
// graded, but the underlying query is cheap and this keeps the cache
// from ever lagging a whole slate behind. Same DST caveat as this
// codebase's other cron schedules (UTC, assumes EDT/UTC-4).
import { refreshConfidenceRecordCache } from "./_shared/confidenceRecordCore";

export const config = { schedule: "0 * * * *" };

export default async (): Promise<Response> => {
  const results = await refreshConfidenceRecordCache();
  console.log("[refresh-confidence-records]", JSON.stringify(results));
  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { "content-type": "application/json" },
  });
};
