import Link from "next/link";
import { LEAGUE_TWO_LEG_COUNT, LEAGUE_THREE_LEG_COUNT, type NbaLeagueParlays } from "@/lib/nbaLeagueParlayHelper";
import { NbaParlayCard, parlayOutcome } from "@/components/NbaParlayCard";
import { BannedBooksToggle } from "@/components/BannedBooksToggle";

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
}

// "YYYY-MM-DD" (ET calendar date) -> "Nov 1" (or "Wed, Nov 4") -- parsed as
// UTC midnight and formatted in UTC so the calendar date never shifts a day
// in either direction regardless of the reader's own timezone.
function formatDate(dateStr: string, withWeekday = false): string {
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

function record(allParlays: NbaLeagueParlays[]): { hit: number; missed: number; pending: number } {
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

function DaySection({ day, tag }: { day: NbaDayParlays; tag?: string }) {
  return (
    <div className="stat-section">
      <h2>
        {formatDate(day.dayKey, true)}
        {tag ? ` — ${tag}` : ""}
      </h2>
      <p className="stat-sub parlay-week-subtitle">{recordLabel(record([day.parlays]))}</p>
      <div className="parlay-grid parlay-grid-current">
        {day.parlays.twoLeg.map((parlay, i) => (
          <NbaParlayCard
            key={`${day.dayKey}-2-${i}`}
            title={`2-Leg Parlay ${i + 1}`}
            parlay={parlay}
            showMatchup
          />
        ))}
        {day.parlays.threeLeg.map((parlay, i) => (
          <NbaParlayCard
            key={`${day.dayKey}-3-${i}`}
            title={`3-Leg Parlay ${i + 1}`}
            parlay={parlay}
            showMatchup
          />
        ))}
      </div>
    </div>
  );
}

export default function NbaParlaysView({
  todayKey,
  weekStart,
  weekEndInclusive,
  days,
  builtAt,
}: {
  todayKey: string;
  weekStart: string;
  weekEndInclusive: string;
  days: NbaDayParlays[];
  builtAt: string | null;
}) {
  const weekLabel = `${formatDate(weekStart)} – ${formatDate(weekEndInclusive)}`;
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
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.5rem" }}>
          <BannedBooksToggle />
        </div>
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
              Week so far: {recordLabel(record(days.map((day) => day.parlays)))}.
              {builtAt ? ` Updated ${formatUpdated(builtAt)}.` : ""}
            </p>
          ) : null}
          <p className="stat-sub parlay-week-subtitle">
            A day&apos;s parlays lock when that day&apos;s first game tips off, so each day below is what the model
            actually found -- results fill in as games finish. Each Sunday starts a new week.
          </p>
        </div>

        {days.length === 0 ? (
          <div className="stat-section">
            <div className="lineup-unavailable">
              No parlay with every leg at one sportsbook is available for this week yet. Sportsbooks usually post
              player props about a day before tip-off, so each day fills in as they do.
            </div>
          </div>
        ) : null}

        {today.map((day) => (
          <DaySection key={day.dayKey} day={day} tag="Today" />
        ))}
        {upcoming.map((day) => (
          <DaySection key={day.dayKey} day={day} tag="Upcoming" />
        ))}
        {earlier.map((day) => (
          <DaySection key={day.dayKey} day={day} />
        ))}

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
