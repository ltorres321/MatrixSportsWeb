import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  getCurrentAdminUserId,
  getEffectiveNow,
  getTimeOverrideRaw,
  setTimeOverride,
} from "@/lib/admin";

// Admin-only testing aid: lets an admin preview how date-dependent
// parts of the site (currently just getCurrentSeasonYear() in
// src/lib/predictions.ts -- which season/week defaults to "current")
// look at a different date/time, WITHOUT touching the real server/VM
// clock. The override is a per-browser HttpOnly cookie
// (admin_time_override, see src/lib/admin.ts), only ever honored for
// a request that independently re-verifies as an admin -- it can
// never affect what any other visitor sees, and never changes
// anything actually stored in the database (live scores, real
// kickoff-based "has this game started" logic, etc. are driven by
// real data, not this clock -- see src/lib/predictions.ts's
// hasStarted()/isScheduleEnabledSeason() for what this override does
// and doesn't reach).
export default async function AdminTimePage() {
  const adminUserId = await getCurrentAdminUserId();
  if (!adminUserId) {
    redirect("/");
  }

  const effectiveNow = await getEffectiveNow();
  const overrideRaw = await getTimeOverrideRaw();

  async function setOverride(formData: FormData) {
    "use server";
    const value = formData.get("datetime");
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error("Provide a date/time");
    }
    await setTimeOverride(new Date(value).toISOString());
    revalidatePath("/", "layout");
  }

  async function clearOverride() {
    "use server";
    await setTimeOverride(null);
    revalidatePath("/", "layout");
  }

  const datetimeLocalDefault = effectiveNow.toISOString().slice(0, 16);

  return (
    <main className="mx-auto max-w-xl px-6 py-16 text-[var(--text)]">
      <h1 className="text-2xl font-semibold text-[var(--text-strong)]">
        Admin: Simulated Time
      </h1>
      <p className="mt-2 text-sm text-[var(--text-dim)]">
        Sets a per-browser override for this admin account only. Only
        affects which season/week the site treats as &ldquo;current&rdquo;
        (getCurrentSeasonYear()) -- live scores and actual game results
        still come from real data, not this clock. The real server
        clock is never touched.
      </p>

      <div className="mt-6 rounded border border-[var(--panel-border)] bg-[var(--panel)] p-4">
        <div className="text-sm text-[var(--text-dim)]">Effective &ldquo;now&rdquo; for this admin:</div>
        <div className="mt-1 font-mono text-lg text-[var(--green)]">
          {effectiveNow.toString()}
        </div>
        {overrideRaw ? (
          <div className="mt-1 text-xs text-[var(--gold)]">Override is ACTIVE.</div>
        ) : (
          <div className="mt-1 text-xs text-[var(--text-dim)]">
            No override set -- showing the real current time.
          </div>
        )}
      </div>

      <form action={setOverride} className="mt-6 flex flex-col gap-3">
        <label className="text-sm text-[var(--text-dim)]" htmlFor="datetime">
          Set simulated date/time
        </label>
        <input
          id="datetime"
          name="datetime"
          type="datetime-local"
          defaultValue={datetimeLocalDefault}
          className="rounded border border-[var(--panel-border)] bg-[var(--panel-solid)] px-3 py-2 text-[var(--text-strong)]"
        />
        <button
          type="submit"
          className="rounded border border-[var(--green-dim)] bg-[var(--panel-solid)] px-4 py-2 text-[var(--green)] hover:bg-[var(--green-faint)]"
        >
          Set override
        </button>
      </form>

      <form action={clearOverride} className="mt-3">
        <button
          type="submit"
          className="rounded border border-[var(--panel-border)] px-4 py-2 text-sm text-[var(--text-dim)] hover:text-[var(--text-strong)]"
        >
          Clear override (use real time)
        </button>
      </form>
    </main>
  );
}
