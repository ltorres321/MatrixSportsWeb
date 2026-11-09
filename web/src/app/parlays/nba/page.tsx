import Link from "next/link";
import { getEarliestNbaPickDay, getNbaLeagueParlayPicks, type NbaDayPick } from "@/lib/nbaLeagueBettingEdge";
import { buildNbaLeagueParlays, type NbaLeagueParlays } from "@/lib/nbaLeagueParlayHelper";
import { recordDisplayedNbaLeagueParlays } from "@/lib/parlayLog";
import { etDateKey, getCurrentNbaWeek, nbaWeekWindow, previousNbaWeekStart } from "@/lib/nbaSchedule";
import { createClient } from "@/lib/supabase/server";
import { cachedAsync } from "@/lib/memoCache";
import NbaParlaysView, { record, type NbaDayParlays, type PastNbaWeekRecord } from "./NbaParlaysView";
import { pageMetadata } from "@/lib/seo";

// Only accepts an already-computed Sunday (every link this page
// generates points at one) -- not a general date parser, just enough
// validation that a malformed ?week= falls back to the current week
// instead of reaching nbaWeekWindow/Postgres with garbage.
const WEEK_PARAM_RE = /^\d{4}-\d{2}-\d{2}$/;

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
// no week numbering to stack -- it shows the current Sunday-to-Saturday ET
// week as one graded unit, with SIX parlays per ET day (4 two-leg + 2
// three-leg, same split as the NFL page's week) built from that day's own
// pool. A day's pool is rebuilt hourly until its first game tips off, then
// frozen (src4/41), so past days are the parlays the model actually found
// and the week's hit/missed record is stable. (2026-11-05: an earlier
// "upcoming games only" version of this page dropped the week's played
// games and their graded results -- this restores them.)
// Going back to a past week is still deferred (user, 2026-11-03).
// Shared by the current week (logged, since it's what's actually
// displayed as "today's" parlays) and both the previous-week record
// teaser and ?week= deep links (never logged -- those are historical
// reads, not a new "shown" event for site_nba_league_parlay_log).
// Cache key is per week, so a deep link to an already-computed
// previous week reuses the same cache entry the teaser filled.
// Exported so the home dashboard's "Parlays to Play" preview can reuse
// the same cached, Postgres-backed build instead of re-deriving it.
export async function loadNbaWeekParlays(
  weekStart: string,
  weekEndExclusive: string,
  hideBannedBooks: boolean,
  log: boolean,
): Promise<{ days: NbaDayParlays[]; builtAt: string | null }> {
  return cachedAsync(`nba-league-parlays:${weekStart}:${hideBannedBooks}`, CACHE_TTL_MS, async () => {
    const { picks, builtAt } = await getNbaLeagueParlayPicks(hideBannedBooks, weekStart, weekEndExclusive);

    // Each ET day is its own pool -- p_rank is already per-day, so the
    // builder's top-N three-leg cap applies within a day, not the week.
    const picksByDay = new Map<string, NbaDayPick[]>();
    for (const pick of picks) {
      picksByDay.set(pick.dayKey, [...(picksByDay.get(pick.dayKey) ?? []), pick]);
    }
    const days: NbaDayParlays[] = [...picksByDay.entries()]
      .map(([dayKey, dayPicks]) => ({ dayKey, parlays: buildNbaLeagueParlays(dayPicks) }))
      .filter((day) => day.parlays.twoLeg.length + day.parlays.threeLeg.length > 0);

    // Same "log what's actually shown, never let a logging failure take
    // the page down" contract as the per-game Parlay Helper tab and
    // NFL's own league page. Runs once per cache fill, not once per
    // page view -- site_nba_league_parlay_log's times_shown now tracks
    // "shown after a cache refresh", not raw page views.
    if (log) {
      const built: NbaLeagueParlays = {
        twoLeg: days.flatMap((day) => day.parlays.twoLeg),
        threeLeg: days.flatMap((day) => day.parlays.threeLeg),
      };
      try {
        await recordDisplayedNbaLeagueParlays(weekStart, built);
      } catch (error) {
        console.error("site_nba_league_parlay_log write failed:", error instanceof Error ? error.message : error);
      }
    }

    return { days, builtAt };
  });
}

export default async function NbaParlaysPage({
  searchParams,
}: {
  searchParams: Promise<{ hideBanned?: string; week?: string }>;
}) {
  const params = await searchParams;
  const hideBannedBooks = params.hideBanned !== "0";
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return <SignUpGate />;
  }

  const currentWeek = getCurrentNbaWeek();
  const requestedWeekStart = params.week && WEEK_PARAM_RE.test(params.week) ? params.week : null;
  const isCurrentWeek = !requestedWeekStart || requestedWeekStart === currentWeek.weekStart;
  const { weekStart, weekEndExclusive, weekEndInclusive } = isCurrentWeek
    ? currentWeek
    : nbaWeekWindow(requestedWeekStart);
  const todayKey = etDateKey(new Date());

  const { days, builtAt } = await loadNbaWeekParlays(weekStart, weekEndExclusive, hideBannedBooks, isCurrentWeek);

  // Only the current week's own view carries the full past-weeks list --
  // a past week's page (?week=) doesn't recursively show one too. Newest
  // week first (user, 2026-11-08: "add newer weeks on top as older weeks
  // fall to the bottom"), going back to the earliest week this table has
  // anything for -- not a hardcoded season start, so it keeps working
  // without edits as the season (or this table's own history) grows.
  let pastWeeks: PastNbaWeekRecord[] = [];
  if (isCurrentWeek) {
    const earliestDay = await cachedAsync("nba-earliest-pick-day", CACHE_TTL_MS, getEarliestNbaPickDay);
    if (earliestDay) {
      const earliestWeekStart = getCurrentNbaWeek(new Date(`${earliestDay}T00:00:00Z`)).weekStart;
      const weekStarts: string[] = [];
      for (
        let cursor = previousNbaWeekStart(currentWeek.weekStart);
        cursor >= earliestWeekStart;
        cursor = previousNbaWeekStart(cursor)
      ) {
        weekStarts.push(cursor);
      }

      const weeks = await Promise.all(
        weekStarts.map(async (ws) => {
          const win = nbaWeekWindow(ws);
          const { days: weekDays } = await loadNbaWeekParlays(win.weekStart, win.weekEndExclusive, hideBannedBooks, false);
          const { hit, missed } = record(weekDays.map((day) => day.parlays));
          return { weekStart: win.weekStart, weekEndInclusive: win.weekEndInclusive, hit, missed };
        }),
      );
      pastWeeks = weeks.filter((w) => w.hit + w.missed > 0);
    }
    console.log("[DEBUG pastWeeks]", JSON.stringify(pastWeeks));
  }

  return (
    <NbaParlaysView
      todayKey={todayKey}
      weekStart={weekStart}
      weekEndInclusive={weekEndInclusive}
      days={days}
      builtAt={builtAt}
      pastWeeks={pastWeeks}
    />
  );
}
