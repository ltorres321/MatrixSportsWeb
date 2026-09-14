import "server-only";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

// admin_users has no RLS policies granted to any client-facing role --
// see sql/009_admin_users_schema.sql. This is the only supported way
// to check admin status; there is no is_admin column on profiles.
export async function getCurrentAdminUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return null;

  const rows = await query<{ user_id: string }>(
    "SELECT user_id FROM admin_users WHERE user_id = $1",
    [user.id]
  );
  return rows.length > 0 ? user.id : null;
}

const TIME_OVERRIDE_COOKIE = "admin_time_override";

// Per-browser, admin-only, never touches the real server/VM clock --
// see the module docstring in web/src/app/admin/time/page.tsx for the
// full reasoning. Only ever set via setTimeOverride() below (a Server
// Action gated on getCurrentAdminUserId()), so it's HttpOnly -- no
// client JS anywhere ever needs to read or write it directly.
//
// Deliberately re-checks admin status here too, not just at the point
// the cookie gets set: a non-admin could still hand-edit their OWN
// browser's raw cookie value (HttpOnly blocks JS, not devtools), so
// honoring the override only for a request that's independently
// verified as an admin closes that off. Worst case if this check were
// skipped is low (it only ever changes which season/week THIS visitor
// sees as "current" -- no elevated data access), but there's no reason
// not to gate it properly.
export async function getEffectiveNow(): Promise<Date> {
  const override = await getActiveTimeOverride();
  return override ?? new Date();
}

// Distinct from getEffectiveNow(): returns null when there's no
// active override (including "not an admin"), rather than silently
// falling back to the real time. Callers that need to behave
// DIFFERENTLY when a simulation is active (not just use a different
// clock value) -- e.g. getDefaultWeek() switching from real-data
// completeness to a hypothetical schedule-based guess -- need this,
// not getEffectiveNow(), or they can't tell "it's genuinely this
// instant" apart from "an admin explicitly asked to pretend it's
// this instant."
export async function getActiveTimeOverride(): Promise<Date | null> {
  const adminUserId = await getCurrentAdminUserId();
  if (!adminUserId) return null;

  const cookieStore = await cookies();
  const raw = cookieStore.get(TIME_OVERRIDE_COOKIE)?.value;
  if (!raw) return null;

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function getTimeOverrideRaw(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(TIME_OVERRIDE_COOKIE)?.value ?? null;
}

export async function setTimeOverride(isoString: string | null): Promise<void> {
  const adminUserId = await getCurrentAdminUserId();
  if (!adminUserId) {
    throw new Error("Not authorized");
  }

  const cookieStore = await cookies();
  if (isoString === null) {
    cookieStore.delete(TIME_OVERRIDE_COOKIE);
    return;
  }

  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date/time");
  }

  cookieStore.set(TIME_OVERRIDE_COOKIE, parsed.toISOString(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // No maxAge -- session cookie. A forgotten override should not
    // outlive the admin's own browser session.
  });
}
