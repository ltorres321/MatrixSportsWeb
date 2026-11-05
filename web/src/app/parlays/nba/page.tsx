import Link from "next/link";
import { getNbaLeagueParlayPicks } from "@/lib/nbaLeagueBettingEdge";
import { buildNbaLeagueParlays, type NbaLeagueParlays } from "@/lib/nbaLeagueParlayHelper";
import { recordDisplayedNbaLeagueParlays } from "@/lib/parlayLog";
import { getCurrentNbaWeek } from "@/lib/nbaSchedule";
import { createClient } from "@/lib/supabase/server";
import { cachedAsync } from "@/lib/memoCache";
import NbaParlaysView from "./NbaParlaysView";
import { pageMetadata } from "@/lib/seo";

// The underlying props/odds only regenerate once an hour (see
// src4/33_predict_live_player_props.py's cron, :15 past the hour), and the
// heavy ranking query now runs in a cron job (src4/41, which fills
// public.nba_league_parlay_picks) -- this page only reads that small table,
// so a read is cheap. The 5-minute cache is still worth keeping: it
// collapses a flood of concurrent visitors into one read + one parlay build
// + one log write every 5 minutes (see memoCache.ts's own header for why
// this also protects against a request stampede on a cache miss).
const CACHE_TTL_MS = 5 * 60 * 1000;

export const metadata = pageMetadata({
  title: "NBA Parlays — Matrix Sports Analytics",
  description:
    "The 6 best-probability NBA parlays for today's and upcoming games, built from our model's highest-confidence player props.",
  path: "/parlays/nba",
});

// Server Component: same registered-users-only gate as /parlays (NFL) --
// see that page's own SignUpGate comment for why no parlay content (or
// its underlying query) runs at all for a signed-out visitor, and for
// why the league-chips switcher below is shown even on this gate.
function SignUpGate() {
  return (
    <>
      <header className="site-header">
        <h1 className="glow">PARLAYS</h1>
        <p className="subtitle">{"// members-only"}</p>
      </header>

      <div className="league-chips" aria-label="Sport selector">
        <Link href="/parlays" className="league-chip">
          NFL
        </Link>
        <button className="league-chip active" type="button">
          NBA
        </button>
      </div>

      <main>
        <div style={{ display: "flex", justifyContent: "center", padding: "3rem 1rem" }}>
          <div className="unlock-card">
            <span className="lock-icon">🔒</span>
            <h2>Sign In to View Parlays</h2>
            <p>
              Create a free account to see our model&apos;s 6 best-probability NBA parlays for upcoming games -- no credit
              card required.
            </p>
            <Link className="btn btn-primary btn-block" href="/signup">
              Sign Up Free
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}

// Unlike /parlays (NFL, which stacks every week of the season), NBA has
// no week numbering to stack. CHANGED 2026-11-05: this used to rank the
// whole current Sunday-to-Sunday window, which on a Wednesday meant the
// "best" parlays were mostly built from Sunday/Monday games already played.
// It now shows only games that haven't started, tipping within the next
// 72 hours (src4/41's LOOKAHEAD_HOURS). getCurrentNbaWeek is still used,
// but only as the stable key site_nba_league_parlay_log groups rows by.
// Going back to a past window is still deferred (user, 2026-11-03).
export default async function NbaParlaysPage({
  searchParams,
}: {
  searchParams: Promise<{ hideBanned?: string }>;
}) {
  const hideBannedBooks = (await searchParams).hideBanned !== "0";
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return <SignUpGate />;
  }

  const { weekStart } = getCurrentNbaWeek();

  const { parlays, builtAt } = await cachedAsync(
    `nba-league-parlays:${weekStart}:${hideBannedBooks}`,
    CACHE_TTL_MS,
    async () => {
      const { picks, builtAt } = await getNbaLeagueParlayPicks(hideBannedBooks);
      const built: NbaLeagueParlays = buildNbaLeagueParlays(picks);

      // Same "log what's actually shown, never let a logging failure take
      // the page down" contract as the per-game Parlay Helper tab and
      // NFL's own league page. Runs once per cache fill, not once per
      // page view -- site_nba_league_parlay_log's times_shown now tracks
      // "shown after a cache refresh", not raw page views.
      try {
        await recordDisplayedNbaLeagueParlays(weekStart, built);
      } catch (error) {
        console.error("site_nba_league_parlay_log write failed:", error instanceof Error ? error.message : error);
      }

      return { parlays: built, builtAt };
    },
  );

  return <NbaParlaysView builtAt={builtAt} parlays={parlays} />;
}
