import { redirect } from "next/navigation";
import { getCurrentAdminUserId } from "@/lib/admin";
import { getTikTokToken } from "@/lib/tiktok";
import TikTokAdminPanel from "./TikTokAdminPanel";

// Admin-only: connect the single TikTok account (Login Kit OAuth) and
// smoke-test the direct Content Posting API integration -- see
// sql/017_tiktok_direct_post_schema.sql for why this exists in place
// of SocialClaw for TikTok specifically.
export default async function AdminTikTokPage() {
  const adminUserId = await getCurrentAdminUserId();
  if (!adminUserId) {
    redirect("/");
  }

  const token = await getTikTokToken();

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-[var(--text)]">
      <h1 className="text-2xl font-semibold text-[var(--text-strong)]">Admin: TikTok Direct Posting</h1>
      <p className="mt-2 text-sm text-[var(--text-dim)]">
        {token ? `Connected (open_id: ${token.open_id}).` : "Not connected yet."}
      </p>
      <p className="mt-2 text-sm text-[var(--text-dim)]">
        Unaudited app: posts are forced private (SELF_ONLY) until TikTok&apos;s audit clears.
      </p>

      <TikTokAdminPanel />
    </main>
  );
}
