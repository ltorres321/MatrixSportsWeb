import Link from "next/link";
import { getNbaLeagueParlayPicks } from "@/lib/nbaLeagueBettingEdge";
import { buildNbaLeagueParlays, type NbaLeagueParlays } from "@/lib/nbaLeagueParlayHelper";
import { recordDisplayedNbaLeagueParlays } from "@/lib/parlayLog";
import { getCurrentNbaWeek } from "@/lib/nbaSchedule";
import { createClient } from "@/lib/supabase/server";
import NbaParlaysView from "./NbaParlaysView";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "NBA Parlays — Matrix Sports Analytics",
  description:
    "The current week's 6 best-probability NBA parlays, built from our model's highest-confidence player props across every game.",
  path: "/parlays/nba",
});

// Server Component: same registered-users-only gate as /parlays (NFL) --
// see that page's own SignUpGate comment for why no parlay content (or
// its underlying query) runs at all for a signed-out visitor.
function SignUpGate() {
  return (
    <>
      <header className="site-header">
        <h1 className="glow">PARLAYS</h1>
        <p className="subtitle">{"// members-only"}</p>
      </header>
      <main>
        <div style={{ display: "flex", justifyContent: "center", padding: "3rem 1rem" }}>
          <div className="unlock-card">
            <span className="lock-icon">🔒</span>
            <h2>Sign In to View Parlays</h2>
            <p>
              Create a free account to see our model&apos;s 6 best-probability NBA parlays every week -- no credit
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
// no week numbering to stack -- this shows just the current
// Sunday-to-Sunday window (getCurrentNbaWeek). Going back to a past
// window is explicitly deferred (user, 2026-11-03: "display current
// week then I will figure out how user can go back in history").
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

  const { weekStart, weekEndExclusive, weekEndInclusive } = getCurrentNbaWeek();

  const picks = await getNbaLeagueParlayPicks(weekStart, weekEndExclusive, hideBannedBooks);
  const parlays: NbaLeagueParlays = buildNbaLeagueParlays(picks);

  // Same "log what's actually shown, never let a logging failure take the
  // page down" contract as the per-game Parlay Helper tab and NFL's own
  // league page.
  try {
    await recordDisplayedNbaLeagueParlays(weekStart, parlays);
  } catch (error) {
    console.error("site_nba_league_parlay_log write failed:", error instanceof Error ? error.message : error);
  }

  return <NbaParlaysView weekStart={weekStart} weekEndInclusive={weekEndInclusive} parlays={parlays} />;
}
