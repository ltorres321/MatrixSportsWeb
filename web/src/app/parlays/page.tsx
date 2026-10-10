import Link from "next/link";
import {
  getAvailableSeasons,
  getWeeksForSeason,
  getDefaultWeek,
  getCurrentSeasonYear,
} from "@/lib/predictions";
import { getLeagueBettingEdge } from "@/lib/pffBettingEdge";
import { buildLeagueParlays, type LeagueParlays } from "@/lib/leagueParlayHelper";
import type { ParlayBookMode } from "@/lib/parlayHelper";
import { recordDisplayedLeagueParlays } from "@/lib/parlayLog";
import { createClient } from "@/lib/supabase/server";
import ParlaysView from "./ParlaysView";

export const metadata = {
  title: "NFL Parlays — Matrix Sports Analytics",
  description:
    "The week's 5 best-probability NFL parlays, built from our model's highest-confidence player props across every game -- plus how last week's picks actually graded out.",
  alternates: { canonical: "https://matrixsports.net/parlays" },
};

export interface WeekParlays {
  season: number;
  week: number;
  // Both modes are built and logged, same "built server-side so what's
  // shown and what's logged can't differ" contract as the per-game
  // Parlay Helper tab -- single is what the page actually shows (see
  // ParlaysView.tsx's own note on why mixed is hidden for now); mixed is
  // kept alongside it in case that changes.
  parlays: Record<ParlayBookMode, LeagueParlays>;
}

async function buildWeekParlays(season: number, week: number): Promise<WeekParlays> {
  const playerProps = await getLeagueBettingEdge(season, week);
  const parlays: Record<ParlayBookMode, LeagueParlays> = {
    single: buildLeagueParlays(playerProps, "single"),
    mixed: buildLeagueParlays(playerProps, "mixed"),
  };

  // Same "log what's actually shown, never let a logging failure take
  // the page down" contract as the per-game Parlay Helper tab (see
  // pffBettingEdge.ts's getGameBettingEdge).
  try {
    await recordDisplayedLeagueParlays(season, week, parlays);
  } catch (error) {
    console.error("site_league_parlay_log write failed:", error instanceof Error ? error.message : error);
  }

  return { season, week, parlays };
}

// Registered-users-only: unlike /home's "full slate" (a blurred teaser +
// sign-up card layered over it, see .locked-section/.unlock-panel in
// globals.css), this page shows NO parlay content at all to a signed-out
// visitor -- just the sign-up prompt below, before any of the
// league-wide queries/parlay-building even run. That's both the
// product decision asked for and a real load-reduction win: the page
// that caused the 2026-10-10 production outage (see pffBettingEdge.ts's
// getLeagueBettingEdge) no longer runs its expensive query at all for
// anonymous/bot traffic, which is most of what a public, unauthenticated
// route gets.
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
            <h3>Sign In to View Parlays</h3>
            <p>
              Create a free account to see our model&apos;s 5 best-probability parlays every week --
              no credit card required.
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

// Server Component: no season/week picker here, unlike /home -- this page
// is deliberately just "the two weeks a visitor actually cares about right
// now," the upcoming slate and how the model's last slate actually graded.
export default async function ParlaysPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return <SignUpGate />;
  }

  const season = await getCurrentSeasonYear();
  const seasons = await getAvailableSeasons();
  const activeSeason = seasons.includes(season) ? season : (seasons[0] ?? season);

  const weeks = await getWeeksForSeason(activeSeason);
  const currentWeek = (await getDefaultWeek(activeSeason)) ?? weeks[weeks.length - 1] ?? null;
  const currentWeekIndex = currentWeek == null ? -1 : weeks.indexOf(currentWeek);
  const previousWeek = currentWeekIndex > 0 ? weeks[currentWeekIndex - 1] : null;

  const [current, previous] = await Promise.all([
    currentWeek != null ? buildWeekParlays(activeSeason, currentWeek) : null,
    previousWeek != null ? buildWeekParlays(activeSeason, previousWeek) : null,
  ]);

  return <ParlaysView season={activeSeason} current={current} previous={previous} />;
}
