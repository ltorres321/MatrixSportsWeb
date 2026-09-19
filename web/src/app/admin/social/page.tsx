import { redirect } from "next/navigation";
import { getCurrentAdminUserId } from "@/lib/admin";
import { getCurrentSpotlightMatchup } from "@/lib/social/currentSpotlight";
import { getMostRecentCompletedWeek } from "@/lib/social/recentCompletedWeek";
import { pickWeeklyInsight } from "@/lib/social/weeklyStats";
import { spotlightCaption, recapCaption, insightCaption, PLATFORMS } from "@/lib/social/captions";

// Preview-only: renders the three social-post templates (game
// spotlight, weekly win/loss recap, weekend data insight) against
// real current data so they can be eyeballed before any actual
// posting pipeline exists. Nothing on this page posts anywhere.
export default async function AdminSocialPage() {
  const adminUserId = await getCurrentAdminUserId();
  if (!adminUserId) {
    redirect("/");
  }

  const spotlightMatchup = await getCurrentSpotlightMatchup();
  const spotlightTexts = spotlightMatchup
    ? PLATFORMS.map((p) => ({ platform: p, text: spotlightCaption(spotlightMatchup, p) }))
    : null;

  const completed = await getMostRecentCompletedWeek();
  const recapText = completed ? recapCaption(completed.season, completed.week, completed.matchups, "facebook") : null;

  const insight = completed ? pickWeeklyInsight(completed.matchups) : null;
  const insightText = insight ? insightCaption(insight, "facebook") : null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-[var(--text)]">
      <h1 className="text-2xl font-semibold text-[var(--text-strong)]">Admin: Social Post Preview</h1>
      <p className="mt-2 text-sm text-[var(--text-dim)]">
        Preview-only for now — nothing on this page posts anywhere. Once Facebook business
        verification clears, this content becomes what actually gets posted.
      </p>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--text-strong)]">Game Spotlight</h2>
        {spotlightMatchup ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/admin/social/preview/spotlight"
              alt="Game spotlight preview"
              className="mt-4 w-full max-w-sm rounded border border-[var(--panel-border)]"
            />
            {spotlightTexts?.map(({ platform, text }) => (
              <div key={platform} className="mt-4">
                <div className="text-xs uppercase tracking-wide text-[var(--text-dim)]">{platform}</div>
                <pre className="mt-1 whitespace-pre-wrap rounded border border-[var(--panel-border)] bg-[var(--panel)] p-4 text-sm text-[var(--text)]">
                  {text}
                </pre>
              </div>
            ))}
          </>
        ) : (
          <p className="mt-2 text-sm text-[var(--text-dim)]">No premier game found for the current week.</p>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--text-strong)]">Weekly Recap</h2>
        {completed ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/admin/social/preview/recap"
              alt="Weekly recap preview"
              className="mt-4 w-full max-w-sm rounded border border-[var(--panel-border)]"
            />
            <pre className="mt-4 whitespace-pre-wrap rounded border border-[var(--panel-border)] bg-[var(--panel)] p-4 text-sm text-[var(--text)]">
              {recapText}
            </pre>
          </>
        ) : (
          <p className="mt-2 text-sm text-[var(--text-dim)]">No completed week found yet.</p>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--text-strong)]">Weekend Data Insight</h2>
        {insight ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/admin/social/preview/insight"
              alt="Weekend insight preview"
              className="mt-4 w-full max-w-sm rounded border border-[var(--panel-border)]"
            />
            <pre className="mt-4 whitespace-pre-wrap rounded border border-[var(--panel-border)] bg-[var(--panel)] p-4 text-sm text-[var(--text)]">
              {insightText}
            </pre>
          </>
        ) : (
          <p className="mt-2 text-sm text-[var(--text-dim)]">No insight available for the most recent completed week.</p>
        )}
      </section>
    </main>
  );
}
