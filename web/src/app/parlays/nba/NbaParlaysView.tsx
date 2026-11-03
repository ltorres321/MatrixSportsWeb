import Link from "next/link";
import { LEAGUE_TWO_LEG_COUNT, LEAGUE_THREE_LEG_COUNT, type NbaLeagueParlays } from "@/lib/nbaLeagueParlayHelper";
import { NbaParlayCard } from "@/components/NbaParlayCard";
import { BannedBooksToggle } from "@/components/BannedBooksToggle";

// NBA sibling of ../ParlaysView.tsx (NFL) -- same card, same notice
// copy/structure, just one Sunday-to-Sunday window instead of every
// week of the season stacked (NBA has no week-number equivalent to
// stack on; see page.tsx's own comment). showMatchup is always on here
// (unlike the per-game Parlay Helper tab) since legs can come from
// different games across the week.

// "YYYY-MM-DD" (ET calendar date) -> "Nov 1" -- parsed as UTC midnight
// and formatted in UTC so the calendar date never shifts a day in
// either direction regardless of the reader's own timezone.
function formatWeekDate(dateStr: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(
    new Date(`${dateStr}T00:00:00Z`),
  );
}

export default function NbaParlaysView({
  weekStart,
  weekEndInclusive,
  parlays,
}: {
  weekStart: string;
  weekEndInclusive: string;
  parlays: NbaLeagueParlays;
}) {
  const weekLabel = `${formatWeekDate(weekStart)} – ${formatWeekDate(weekEndInclusive)}`;

  return (
    <>
      <header className="site-header">
        <h1 className="glow">NBA PARLAYS</h1>
        <p className="subtitle">{"// our model's 6 best-probability parlays, picked from every game this week"}</p>
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
            <strong>Use these as a starting point, not a guarantee.</strong> These are the {LEAGUE_TWO_LEG_COUNT +
              LEAGUE_THREE_LEG_COUNT} strongest combinations our model finds across this week&apos;s entire NBA
            slate, picked purely by probability -- legs can come from different games. Every parlay below uses legs
            from a single book you can place as one slip. Check that your book offers every leg, at these lines,
            before you bet.
          </p>
        </div>

        <div className="stat-section">
          <h2>Week of {weekLabel} Parlays</h2>
          <p className="stat-sub parlay-week-subtitle">
            This week&apos;s games haven&apos;t all been played yet -- these are the model&apos;s current best
            picks, not graded results.
          </p>
          {parlays.twoLeg.length === 0 ? (
            <div className="lineup-unavailable">
              No parlay with every leg at one sportsbook is available for this week yet.
            </div>
          ) : (
            <div className="parlay-grid parlay-grid-current">
              {parlays.twoLeg.map((parlay, i) => (
                <NbaParlayCard key={`2-${i}`} title={`2-Leg Parlay ${i + 1}`} parlay={parlay} showMatchup />
              ))}
              {parlays.threeLeg.map((parlay, i) => (
                <NbaParlayCard key={`3-${i}`} title={`3-Leg Parlay ${i + 1}`} parlay={parlay} showMatchup />
              ))}
            </div>
          )}
        </div>

        <div className="parlay-notice" role="note">
          <p>
            Legs are drawn from every player prop our model scored this week across every game, ranked purely by
            the model&apos;s own probability. Chance to hit multiplies each leg&apos;s probability and assumes the
            legs are independent. Payout is the total returned on a $1 bet, including your $1 stake, estimated from
            each leg&apos;s listed odds; sportsbooks price parlays themselves, so the real payout is usually lower.
          </p>
        </div>
      </main>
    </>
  );
}
