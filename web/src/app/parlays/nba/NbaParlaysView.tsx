import Link from "next/link";
import { LEAGUE_TWO_LEG_COUNT, LEAGUE_THREE_LEG_COUNT, type NbaLeagueParlays } from "@/lib/nbaLeagueParlayHelper";
import { NbaParlayCard, parlayOutcome } from "@/components/NbaParlayCard";
import { nextNbaWeekStart, previousNbaWeekStart } from "@/lib/nbaSchedule";
import type { PropEditRow } from "@/lib/propEditMath";
import type { OddsFormat } from "@/lib/oddsFormat";

// NBA sibling of ../ParlaysView.tsx (NFL) -- same card, same notice
// copy/structure. NFL stacks one block per week; NBA has no week numbers
// and plays almost nightly, so this shows ONE Sunday-to-Saturday ET week as
// a graded unit, with a block per ET day (6 parlays each) -- today first,
// like the NFL page leads with the current week. showMatchup is always on
// (unlike the per-game Parlay Helper tab) since legs can come from
// different games across a day.

export interface NbaDayParlays {
  dayKey: string; // "YYYY-MM-DD", ET calendar date
  parlays: NbaLeagueParlays;
  // True when My Bookies filtering found nothing at the user's own
  // books for this day and fell back to the day's unfiltered best picks
  // instead of showing a blank day (page.tsx's filterDaysToEnabledBooks).
  // Undefined/false on pages that never filter by book preference.
  usedFallback?: boolean;
}

// "YYYY-MM-DD" (ET calendar date) -> "Nov 1" (or "Wed, Nov 4") -- parsed as
// UTC midnight and formatted in UTC so the calendar date never shifts a day
// in either direction regardless of the reader's own timezone.
export function formatDate(dateStr: string, withWeekday = false): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    ...(withWeekday ? { weekday: "short" } : {}),
  }).format(new Date(`${dateStr}T00:00:00Z`));
}

// ISO timestamp -> "Nov 4, 7:15 PM ET" -- always Eastern, regardless of the
// reader's own timezone (every tip time on this site is ET).
function formatUpdated(iso: string): string {
  return (
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso)) + " ET"
  );
}

export function record(allParlays: NbaLeagueParlays[]): { hit: number; missed: number; pending: number } {
  const counts = { hit: 0, missed: 0, pending: 0 };
  for (const parlays of allParlays) {
    for (const parlay of [...parlays.twoLeg, ...parlays.threeLeg]) {
      const outcome = parlayOutcome(parlay);
      if (outcome === "hit") counts.hit += 1;
      else if (outcome === "missed") counts.missed += 1;
      else counts.pending += 1;
    }
  }
  return counts;
}

function recordLabel(r: { hit: number; missed: number; pending: number }): string {
  return `${r.hit} hit · ${r.missed} missed · ${r.pending} pending`;
}

// Shown both above the week's day listing and again above the bottom
// disclaimer (user, 2026-11-08) -- same three links either place, just
// relative to whatever week is currently displayed (weekStart), not
// necessarily the real current week.
function WeekNav({ weekStart }: { weekStart: string }) {
  return (
    <div className="week-nav" style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", margin: "0.75rem 0" }}>
      <Link className="btn btn-ghost" href={`/parlays/nba?week=${previousNbaWeekStart(weekStart)}`}>
        ← Previous Week
      </Link>
      <Link className="btn btn-ghost" href="/parlays/nba">
        Current Week
      </Link>
      <Link className="btn btn-ghost" href={`/parlays/nba?week=${nextNbaWeekStart(weekStart)}`}>
        Next Week →
      </Link>
    </div>
  );
}

function DaySection({
  day,
  tag,
  enabledBooks,
  propEdits,
  oddsFormat,
}: {
  day: NbaDayParlays;
  tag?: string;
  enabledBooks: string[];
  propEdits: Record<string, PropEditRow>;
  oddsFormat: OddsFormat;
}) {
  // Line Edit's pick-key scope for this whole day -- see
  // propEditMath.ts's buildPickKey for why league pages scope by day
  // instead of by game.
  const scope = `day:${day.dayKey}`;
  return (
    <div className="stat-section">
      <h2>
        {formatDate(day.dayKey, true)}
        {tag ? ` — ${tag}` : ""}
      </h2>
      <p className="stat-sub parlay-week-subtitle">{recordLabel(record([day.parlays]))}</p>
      {day.usedFallback && (
        <p className="parlay-fallback-note" role="note">
          None of today&apos;s parlays matched your My Bookies picks, so these are the model&apos;s best overall
          picks instead -- check the book shown on each before you bet. <Link href="/profile#my-bookies">Change Bookie Preference</Link>
        </p>
      )}
      <div className="parlay-grid parlay-grid-current">
        {day.parlays.twoLeg.map((parlay, i) => (
          <NbaParlayCard
            key={`${day.dayKey}-2-${i}`}
            title={`2-Leg Parlay ${i + 1}`}
            parlay={parlay}
            showMatchup
            enabledBooks={enabledBooks}
            scope={scope}
            propEdits={propEdits}
            oddsFormat={oddsFormat}
          />
        ))}
        {day.parlays.threeLeg.map((parlay, i) => (
          <NbaParlayCard
            key={`${day.dayKey}-3-${i}`}
            title={`3-Leg Parlay ${i + 1}`}
            parlay={parlay}
            showMatchup
            enabledBooks={enabledBooks}
            scope={scope}
            propEdits={propEdits}
            oddsFormat={oddsFormat}
          />
        ))}
      </div>
    </div>
  );
}

export interface PastNbaWeekRecord {
  weekStart: string;
  weekEndInclusive: string;
  hit: number;
  missed: number;
}

export default function NbaParlaysView({
  todayKey,
  weekStart,
  weekEndInclusive,
  days,
  builtAt,
  pastWeeks,
  enabledBooks,
  propEdits,
  oddsFormat,
}: {
  todayKey: string;
  weekStart: string;
  weekEndInclusive: string;
  days: NbaDayParlays[];
  builtAt: string | null;
  pastWeeks?: PastNbaWeekRecord[];
  enabledBooks: string[];
  propEdits: Record<string, PropEditRow>;
  oddsFormat: OddsFormat;
}) {
  const weekLabel = `${formatDate(weekStart)} – ${formatDate(weekEndInclusive)}`;
  const weekRecord = record(days.map((day) => day.parlays));
  const weekGraded = weekRecord.hit + weekRecord.missed;
  const today = days.filter((day) => day.dayKey === todayKey);
  const upcoming = days.filter((day) => day.dayKey > todayKey).sort((a, b) => a.dayKey.localeCompare(b.dayKey));
  const earlier = days.filter((day) => day.dayKey < todayKey).sort((a, b) => b.dayKey.localeCompare(a.dayKey));

  return (
    <>
      <header className="site-header">
        <h1 className="glow">NBA PARLAYS</h1>
        <p className="subtitle">{"// our model's 6 best-probability parlays for every day, graded Sunday to Saturday"}</p>
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
        <div className="parlay-notice" role="note">
          <p>
            <strong>Play responsibly.</strong> Gambling carries real risk, and parlays are long shots that lose far
            more often than they win. Only bet what you can afford to lose, set limits, and treat any winnings as a
            bonus. If gambling stops being fun, call or text 1-800-GAMBLER. You must be of legal betting age where
            you live.
          </p>
          <p>
            <strong>Use these as a starting point, not a guarantee.</strong> Each day shows the{" "}
            {LEAGUE_TWO_LEG_COUNT + LEAGUE_THREE_LEG_COUNT} strongest combinations our model finds across that
            day&apos;s NBA slate, picked purely by probability -- legs can come from different games. Every parlay
            below uses legs from a single book you can place as one slip. Check that your book offers every leg, at
            these lines, before you bet.
          </p>
        </div>

        <div className="stat-section">
          <h2>Week of {weekLabel}</h2>
          {days.length > 0 ? (
            <p className="stat-sub parlay-week-subtitle">
              Week so far: {recordLabel(weekRecord)}.
              {builtAt ? ` Updated ${formatUpdated(builtAt)}.` : ""}
            </p>
          ) : null}
          <p className="stat-sub parlay-week-subtitle">
            A day&apos;s parlays lock when that day&apos;s first game tips off, so each day below is what the model
            actually found -- results fill in as games finish. Each Sunday starts a new week.
          </p>
        </div>

        {weekGraded > 0 ? (
          <p className="week-record-badge">
            (Week Performance: {weekRecord.hit} of {weekGraded} [{((weekRecord.hit / weekGraded) * 100).toFixed(1)}%])
          </p>
        ) : null}

        <WeekNav weekStart={weekStart} />

        {days.length === 0 ? (
          <div className="stat-section">
            <div className="lineup-unavailable">
              No parlay with every leg at one sportsbook is available for this week yet. Sportsbooks usually post
              player props about a day before tip-off, so each day fills in as they do.
            </div>
          </div>
        ) : null}

        {today.map((day) => (
          <DaySection
            key={day.dayKey}
            day={day}
            tag="Today"
            enabledBooks={enabledBooks}
            propEdits={propEdits}
            oddsFormat={oddsFormat}
          />
        ))}
        {upcoming.map((day) => (
          <DaySection
            key={day.dayKey}
            day={day}
            tag="Upcoming"
            enabledBooks={enabledBooks}
            propEdits={propEdits}
            oddsFormat={oddsFormat}
          />
        ))}
        {earlier.map((day) => (
          <DaySection
            key={day.dayKey}
            day={day}
            enabledBooks={enabledBooks}
            propEdits={propEdits}
            oddsFormat={oddsFormat}
          />
        ))}

        {pastWeeks && pastWeeks.length > 0 ? (
          <div className="stat-section">
            {/* Same 3-across grid as the parlay cards above (user,
                2026-11-16: "groups of 3 just like the parlays") instead
                of stacking plain text links, which ran together on one
                line with no real spacing. */}
            <div className="parlay-grid">
              {pastWeeks.map((w) => (
                <Link key={w.weekStart} href={`/parlays/nba?week=${w.weekStart}`} className="nba-past-week-card">
                  {formatDate(w.weekStart)} – {formatDate(w.weekEndInclusive)}: {w.hit}-{w.hit + w.missed} (
                  {((w.hit / (w.hit + w.missed)) * 100).toFixed(1)}% correct)
                </Link>
              ))}
              {/* Pads a non-multiple-of-3 count out to a full row so the
                  real tiles above stay 3-columns-wide instead of
                  stretching to fill the gap -- see .nba-past-week-filler's
                  own comment in globals.css. */}
              {Array.from({ length: (3 - (pastWeeks.length % 3)) % 3 }).map((_, i) => (
                <div key={`filler-${i}`} className="nba-past-week-filler" aria-hidden="true" />
              ))}
            </div>
          </div>
        ) : null}

        <WeekNav weekStart={weekStart} />

        <div className="parlay-notice" role="note">
          <p>
            Legs are drawn from every player prop our model scored for that day&apos;s games, ranked purely by the
            model&apos;s own probability. Chance to hit multiplies each leg&apos;s probability and assumes the legs
            are independent. Payout is the total returned on a $1 bet, including your $1 stake, estimated from each
            leg&apos;s listed odds; sportsbooks price parlays themselves, so the real payout is usually lower.
          </p>
        </div>
      </main>
    </>
  );
}
