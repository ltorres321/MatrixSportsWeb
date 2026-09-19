import "server-only";

// Machine-to-machine auth for the standalone content-generation jobs
// in /home/neo/SportsContentCreation -- deliberately separate from
// getCurrentAdminUserId()'s cookie-based admin check (lib/admin.ts),
// since these calls come from a plain script with no browser session,
// not an interactively logged-in admin.
export function isAuthorizedContentJob(request: Request): boolean {
  const secret = process.env.CONTENT_JOB_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
