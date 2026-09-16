import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentAdminUserId } from "@/lib/admin";
import { getStoriesForReview, publishStory, rejectStory, unpublishStory, type Story } from "@/lib/stories";

// Moderation view for AI-generated stories (see
// netlify/functions/weekly-stories.mts) -- generation auto-publishes
// immediately now, so this is no longer a required gate before
// anything goes live. It's still where a bad one gets pulled: every
// published story keeps its source_facts here so a claim can always
// be checked against what actually grounded it, and "Take Down" is
// the undo. The draft/approve flow below still exists for any story
// that somehow lands as a draft (e.g. manual testing), but that's not
// the normal path anymore.
export default async function AdminStoriesPage() {
  const adminUserId = await getCurrentAdminUserId();
  if (!adminUserId) {
    redirect("/");
  }

  const stories = await getStoriesForReview();
  const drafts = stories.filter((s) => s.status === "draft");
  const published = stories.filter((s) => s.status === "published");

  async function approve(formData: FormData) {
    "use server";
    const id = formData.get("id");
    if (typeof id !== "string") return;
    await publishStory(id);
    revalidatePath("/admin/stories");
    revalidatePath("/");
  }

  async function reject(formData: FormData) {
    "use server";
    const id = formData.get("id");
    if (typeof id !== "string") return;
    await rejectStory(id);
    revalidatePath("/admin/stories");
  }

  async function takeDown(formData: FormData) {
    "use server";
    const id = formData.get("id");
    if (typeof id !== "string") return;
    await unpublishStory(id);
    revalidatePath("/admin/stories");
    revalidatePath("/");
  }

  function StoryCard({ story }: { story: Story }) {
    return (
      <div className="rounded border border-[var(--panel-border)] bg-[var(--panel)] p-4">
        <div className="text-xs text-[var(--text-dim)]">
          Season {story.season}, Week {story.week} &middot; {new Date(story.created_at).toLocaleString()}
        </div>
        <div className="mt-2 text-lg font-semibold text-[var(--text-strong)]">{story.headline}</div>
        <p className="mt-2 text-sm text-[var(--text)]">{story.body}</p>

        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-[var(--text-dim)]">Source facts (what actually grounded this)</summary>
          <pre className="mt-2 overflow-x-auto rounded bg-[var(--panel-solid)] p-3 text-xs text-[var(--text-dim)]">
            {JSON.stringify(story.source_facts, null, 2)}
          </pre>
        </details>

        {story.status === "draft" && (
          <div className="mt-4 flex gap-3">
            <form action={approve}>
              <input type="hidden" name="id" value={story.id} />
              <button
                type="submit"
                className="rounded border border-[var(--green-dim)] bg-[var(--panel-solid)] px-4 py-2 text-sm text-[var(--green)] hover:bg-[var(--green-faint)]"
              >
                Publish
              </button>
            </form>
            <form action={reject}>
              <input type="hidden" name="id" value={story.id} />
              <button
                type="submit"
                className="rounded border border-[var(--panel-border)] px-4 py-2 text-sm text-[var(--text-dim)] hover:text-[var(--text-strong)]"
              >
                Reject
              </button>
            </form>
          </div>
        )}
        {story.status === "published" && (
          <div className="mt-4 flex items-center gap-3">
            <span className="text-xs text-[var(--gold)]">
              Published {story.published_at ? new Date(story.published_at).toLocaleString() : ""}
            </span>
            <form action={takeDown}>
              <input type="hidden" name="id" value={story.id} />
              <button
                type="submit"
                className="rounded border border-[var(--red)] px-3 py-1 text-xs text-[var(--red)] hover:bg-[var(--red)] hover:text-[var(--panel-solid)]"
              >
                Take Down
              </button>
            </form>
          </div>
        )}
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-[var(--text)]">
      <h1 className="text-2xl font-semibold text-[var(--text-strong)]">Admin: Stories</h1>
      <p className="mt-2 text-sm text-[var(--text-dim)]">
        AI-generated from real final scores and records only -- these publish automatically, no
        review required first. Check the source facts against the generated copy, and use{" "}
        <strong>Take Down</strong> on anything that shouldn&apos;t be live.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-[var(--text-strong)]">
        Pending review ({drafts.length})
      </h2>
      <div className="mt-3 flex flex-col gap-4">
        {drafts.length === 0 && <p className="text-sm text-[var(--text-dim)]">No drafts waiting.</p>}
        {drafts.map((story) => (
          <StoryCard key={story.id} story={story} />
        ))}
      </div>

      <h2 className="mt-10 text-lg font-semibold text-[var(--text-strong)]">Published</h2>
      <div className="mt-3 flex flex-col gap-4">
        {published.length === 0 && <p className="text-sm text-[var(--text-dim)]">Nothing published yet.</p>}
        {published.map((story) => (
          <StoryCard key={story.id} story={story} />
        ))}
      </div>
    </main>
  );
}
