import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  getCurrentAdminUserId,
  getEffectiveNow,
  getTimeOverrideRaw,
  setTimeOverride,
} from "@/lib/admin";

// Admin-only testing aid: lets an admin preview how date-dependent
// parts of the site look at a different date/time, WITHOUT touching
// the real server/VM clock. The override is a per-browser HttpOnly
// cookie (admin_time_override, see src/lib/admin.ts), only ever
// honored for a request that independently re-verifies as an admin --
// it can never affect what any other visitor sees, and never writes
// anything to the database.
//
// WHAT IT ACTUALLY AFFECTS, PRECISELY:
//   - getCurrentSeasonYear() -- which season/week the site defaults to
//     as "current."
//   - getPremierGame()'s candidate filtering -- a game whose real
//     kickoff (game_date) is before the simulated "now" is treated as
//     no longer a candidate for the featured slot, even with no real
//     score yet (there can't be one for a genuinely future simulated
//     date -- the game hasn't actually been played). Real score/live
//     data always wins when it exists; this is only a fallback.
//   - It does NOT fake an actual live score or a "Final" result
//     anywhere on the site (resolveGameState() in predictions.ts still
//     only shows "live"/"final" off real data) -- previewing a future
//     date shows upcoming games as upcoming, not with invented scores.
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
        Sets a per-browser override for this admin account only. Affects
        which season/week the site treats as &ldquo;current&rdquo; and
        which game is featured as the premier matchup once its kickoff
        has passed the simulated time. Never invents a live score or a
        final result -- those still only ever come from real data. The
        real server clock is never touched.
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
