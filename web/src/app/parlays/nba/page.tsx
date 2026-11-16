import Link from "next/link";
import { getEarliestNbaPickDay, getNbaLeagueParlayPicks, type NbaDayPick } from "@/lib/nbaLeagueBettingEdge";
import { buildNbaLeagueParlays, type NbaLeagueParlays } from "@/lib/nbaLeagueParlayHelper";
import { recordDisplayedNbaLeagueParlays } from "@/lib/parlayLog";
import { etDateKey, getCurrentNbaWeek, nbaWeekWindow, previousNbaWeekStart } from "@/lib/nbaSchedule";
import { createClient } from "@/lib/supabase/server";
import { getUserEnabledBooks, filterParlaysToEnabledBooksWithFallback } from "@/lib/sportsbookPrefs";
import { BANNED_US_BOOKS, DEFAULT_OFF_BOOKS } from "@/lib/pffBettingEdge";
import { getUserPropEdits } from "@/lib/propEdits";
import { getUserOddsFormat } from "@/lib/oddsFormatPrefs";
import { cachedAsync } from "@/lib/memoCache";
import NbaParlaysView, { record, type NbaDayParlays, type PastNbaWeekRecord } from "./NbaParlaysView";
import { pageMetadata } from "@/lib/seo";

// NBA league parlays read a table SportsAnalytics materializes hourly
// for only two fixed book variants (hide_banned true/false -- see
// nbaLeagueBettingEdge.ts's own comment), so a per-user book list can't
// reach that query the way it reaches the live-queried pages (game/[id],
// nba/game/[id], /parlays). Best available fix: drop whole parlays that
// use a book outside the user's picks AFTER the (still shared, still
// cached) fetch -- no per-leg re-pricing to a different allowed book,
// since this table stores one bookmaker per pick, not alternatives.
// loadNbaWeekParlays' own cache key is deliberately untouched by this --
// the cached value is the same for every user, this just filters the
// copy returned to this one request.
//
// NEVER returns a blank day (user, 2026-11-15): one book can hold the
// single best price on the large majority of a day's top-ranked picks
// (seen in practice up to ~95% of a day's picks on one book), so a user
// whose own books exclude that one book could otherwise lose the whole
// day to the filter above. filterParlaysToEnabledBooksWithFallback falls
// back to a US-legal-book pick first (see that function's own comment
// for why it needs `usAllowedDays` -- a separately loaded, independently
// re-ranked pool, not a post-filter of `days` -- to actually find one),
// then to the day's unfiltered best picks if even that's empty; either
// way usedFallback flags it so NbaParlaysView can tell the user these
// particular picks aren't necessarily at one of their own books.
function filterDaysToEnabledBooks(
  days: NbaDayParlays[],
  usAllowedDays: NbaDayParlays[],
  enabledBooks: string[],
): NbaDayParlays[] {
  if (enabledBooks.length === 0) return days;
  const usAllowedByDay = new Map(usAllowedDays.map((d) => [d.dayKey, d]));
  return days.map((day) => {
    const usDay = usAllowedByDay.get(day.dayKey);
    const twoLeg = filterParlaysToEnabledBooksWithFallback(
      day.parlays.twoLeg,
      enabledBooks,
      usDay?.parlays.twoLeg,
    );
    const threeLeg = filterParlaysToEnabledBooksWithFallback(
      day.parlays.threeLeg,
      enabledBooks,
      usDay?.parlays.threeLeg,
    );
    return {
      ...day,
      parlays: { twoLeg: twoLeg.items, threeLeg: threeLeg.items },
      usedFallback: twoLeg.usedFallback || threeLeg.usedFallback,
    };
  });
}

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
  // Which of DEFAULT_OFF_BOOKS (sportzino, fliff) the signed-in user has
  // actually put in their own My Bookies picks -- empty by default (user,
  // 2026-11-16: "filter those games out by default", then "create a
  // toggle ... enable/disable coin based books", covering both the same
  // way). nba/page.tsx passes `enabledBooks.filter((b) =>
  // DEFAULT_OFF_BOOKS.includes(b))`; any other coin book a user has NOT
  // enabled stays excluded even if this list is non-empty for a
  // different one. Filtered here, before buildNbaLeagueParlays picks its
  // top N, for the same reason loadUsAllowedNbaWeekParlays rebuilds
  // instead of post-filtering -- a coin book can otherwise win most of a
  // day's top-ranked picks outright (confirmed live: 5 of 6 home-page
  // preview parlays were "All legs at Sportzino"), and a post-filter of
  // an already-capped top-N can't recover what it would have picked
  // instead. The home page's NBA preview has no per-user book awareness
  // at all, so it always calls this with the default ([]) -- coin books
  // are simply never part of that teaser, by design, not a gap to close
  // there.
  enabledCoinBooks: string[] = [],
): Promise<{ days: NbaDayParlays[]; builtAt: string | null }> {
  const coinKey = [...enabledCoinBooks].sort().join(",");
  return cachedAsync(`nba-league-parlays:${weekStart}:${hideBannedBooks}:${coinKey}`, CACHE_TTL_MS, async () => {
    const { picks, builtAt } = await getNbaLeagueParlayPicks(hideBannedBooks, weekStart, weekEndExclusive);
    const eligiblePicks = picks.filter(
      (p) => p.bookmaker == null || !DEFAULT_OFF_BOOKS.includes(p.bookmaker) || enabledCoinBooks.includes(p.bookmaker),
    );

    // Each ET day is its own pool -- p_rank is already per-day, so the
    // builder's top-N three-leg cap applies within a day, not the week.
    const picksByDay = new Map<string, NbaDayPick[]>();
    for (const pick of eligiblePicks) {
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

// Tier 2's candidate pool for filterParlaysToEnabledBooksWithFallback
// (user, 2026-11-16: "the US filter not being applied here... lets lean
// on US books next", then "sportzino is not real money games... filter
// those games out by default"). Deliberately does NOT reuse
// nbaLeagueBettingEdge.ts's hide_banned=true table variant: that variant
// only strips tonybet/stoiximan/bet99 (not elabet or sportzino), AND it
// still stores just one row per pick -- the single best-priced book for
// that pick among whatever it allows -- so a day whose best price for a
// given stat already landed on elabet/sportzino has no OTHER book's
// price for that same pick to fall back to; post-filtering its own
// already-picked top-N can come up empty even when a real US book has a
// usable combo further down the full ranking (confirmed live: a day's
// top 2 three-leg slots can both be elabet/sportzino even under
// hide_banned=true). Rebuilding from the FULL hide_banned=false picks
// pool, with every excluded book's picks dropped BEFORE ranking/
// selecting the top N (not after), finds the actual best combo among
// everything that's left -- same buildNbaLeagueParlays the primary pool
// uses, just fed a pre-trimmed picks list.
const US_FALLBACK_EXCLUDED_BOOKS = [...BANNED_US_BOOKS, ...DEFAULT_OFF_BOOKS];

async function loadUsAllowedNbaWeekParlays(
  weekStart: string,
  weekEndExclusive: string,
): Promise<{ days: NbaDayParlays[] }> {
  return cachedAsync(`nba-league-parlays-us-allowed:${weekStart}`, CACHE_TTL_MS, async () => {
    const { picks } = await getNbaLeagueParlayPicks(false, weekStart, weekEndExclusive);
    const usAllowedPicks = picks.filter((p) => p.bookmaker == null || !US_FALLBACK_EXCLUDED_BOOKS.includes(p.bookmaker));

    const picksByDay = new Map<string, NbaDayPick[]>();
    for (const pick of usAllowedPicks) {
      picksByDay.set(pick.dayKey, [...(picksByDay.get(pick.dayKey) ?? []), pick]);
    }
    const days: NbaDayParlays[] = [...picksByDay.entries()].map(([dayKey, dayPicks]) => ({
      dayKey,
      parlays: buildNbaLeagueParlays(dayPicks),
    }));

    return { days };
  });
}

export default async function NbaParlaysPage({
  searchParams,
}: {
  searchParams: Promise<{ hideBanned?: string; week?: string }>;
}) {
  const params = await searchParams;
  // Default OFF (user, 2026-11-14) -- "My Bookies" now owns this decision per user.
  const hideBannedBooks = params.hideBanned === "1";
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return <SignUpGate />;
  }
  const enabledBooks = await getUserEnabledBooks(supabase, userData.user.id);
  // Which coin-based books (if any) this user actually opted into --
  // loadNbaWeekParlays' own param comment covers why this is passed
  // through rather than a single-book boolean.
  const enabledCoinBooks = enabledBooks.filter((b) => DEFAULT_OFF_BOOKS.includes(b));
  const propEdits = await getUserPropEdits(supabase, userData.user.id);
  const oddsFormat = await getUserOddsFormat(supabase, userData.user.id);

  const currentWeek = getCurrentNbaWeek();
  const requestedWeekStart = params.week && WEEK_PARAM_RE.test(params.week) ? params.week : null;
  const isCurrentWeek = !requestedWeekStart || requestedWeekStart === currentWeek.weekStart;
  const { weekStart, weekEndExclusive, weekEndInclusive } = isCurrentWeek
    ? currentWeek
    : nbaWeekWindow(requestedWeekStart);
  const todayKey = etDateKey(new Date());

  const loaded = await loadNbaWeekParlays(
    weekStart,
    weekEndExclusive,
    hideBannedBooks,
    isCurrentWeek,
    enabledCoinBooks,
  );
  // Tier 2's candidate pool -- see loadUsAllowedNbaWeekParlays's own
  // comment for why this is an independent rebuild, not the hideBanned
  // toggle's own pool.
  const usAllowedLoaded = await loadUsAllowedNbaWeekParlays(weekStart, weekEndExclusive);
  const days = filterDaysToEnabledBooks(loaded.days, usAllowedLoaded.days, enabledBooks);
  const builtAt = loaded.builtAt;

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

      // Every week in this loop is already in the past (it only runs
      // for weeks before currentWeek) -- no "My Bookies" filtering here
      // at all (user, 2026-11-16: "historical can not change... rules
      // will be going forward"), same reasoning as the NFL page's
      // identical fix: a past week's picks/grading already happened at
      // whatever book the model actually used, so re-filtering it by a
      // preference that didn't exist yet (or has since changed) can
      // only ever remove real graded history, never correct it.
      const weeks = await Promise.all(
        weekStarts.map(async (ws) => {
          const win = nbaWeekWindow(ws);
          const loadedWeek = await loadNbaWeekParlays(win.weekStart, win.weekEndExclusive, hideBannedBooks, false);
          const { hit, missed } = record(loadedWeek.days.map((day) => day.parlays));
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
      enabledBooks={enabledBooks}
      propEdits={propEdits}
      oddsFormat={oddsFormat}
    />
  );
}
