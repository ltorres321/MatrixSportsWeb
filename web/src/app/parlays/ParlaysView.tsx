import { PARLAY_POOL_SIZE } from "@/lib/parlayHelper";
import { ParlayCard } from "@/components/ParlayCard";
import type { WeekParlays } from "./page";

// League-wide sibling of GameDetailView.tsx's ParlayHelperView -- same
// card, same notice copy, same Hit/Missed grading (ParlayCard reads
// parlay.legs[].entry.pickResult/actualValue, which PFF's grading job
// populates post-game the same way regardless of which page reads it),
// just built from every game in a week instead of one.

function WeekSection({
  title,
  subtitle,
  data,
}: {
  title: string;
  subtitle: string;
  data: WeekParlays | null;
}) {
  // Mixed-book mode is hidden, not removed -- same reasoning as
  // GameDetailView.tsx's ParlayHelperView, with an extra wrinkle here:
  // a league-wide single-book parlay can span several different games,
  // and nobody's verified by hand yet that every book in
  // etl.player_prop_lines_current/pick_sportsbook actually lets you
  // combine legs from different games into one same-game-style slip
  // the way a per-game parlay can. Single-book is still built, logged,
  // and shown (parlays.single below) since that's the safer default
  // until that's confirmed; parlays.mixed is still built and logged
  // server-side (see page.tsx/parlayLog.ts) in case cross-book display
  // comes back once book coverage is checked.
  const mixedBooks = false;

  // Same two-tier empty check as ParlayHelperView: parlays.mixed is the
  // more permissive mode (no single-book requirement), so an empty
  // mixed result means there's really no usable prop data yet -- a
  // single-book-only empty result, below, is a narrower "data exists,
  // just nothing combinable at one book" case.
  if (!data || data.parlays.mixed.twoLeg.length === 0) {
    return (
      <div className="stat-section">
        <h2>{title}</h2>
        <div className="lineup-unavailable">Parlay suggestions aren&apos;t available for this week yet.</div>
      </div>
    );
  }

  const { twoLeg, threeLeg } = mixedBooks ? data.parlays.mixed : data.parlays.single;

  if (twoLeg.length === 0) {
    return (
      <div className="stat-section">
        <h2>{title}</h2>
        <div className="lineup-unavailable">
          No parlay with every leg at one sportsbook for this week yet.
        </div>
      </div>
    );
  }

  return (
    <div className="stat-section">
      <h2>{title}</h2>
      <p className="stat-sub">{subtitle}</p>
      <div className="parlay-grid">
        {twoLeg.map((parlay, i) => (
          <ParlayCard key={`2-${i}`} title={`2-Leg Parlay ${i + 1}`} parlay={parlay} showMatchup />
        ))}
        {threeLeg.map((parlay, i) => (
          <ParlayCard key={`3-${i}`} title={`3-Leg Parlay ${i + 1}`} parlay={parlay} showMatchup />
        ))}
      </div>
    </div>
  );
}

export default function ParlaysView({
  season,
  current,
  previous,
}: {
  season: number;
  current: WeekParlays | null;
  previous: WeekParlays | null;
}) {
  return (
    <>
      <header className="site-header">
        <h1 className="glow">{season} SEASON — PARLAYS</h1>
        <p className="subtitle">{"// our model's 6 best-probability parlays, picked from every game each week"}</p>
      </header>

      <main>
        <div className="parlay-notice" role="note">
          <p>
            <strong>Play responsibly.</strong> Gambling carries real risk, and parlays are long shots that lose far
            more often than they win. Only bet what you can afford to lose, set limits, and treat any winnings as a
            bonus. If gambling stops being fun, call or text 1-800-GAMBLER. You must be of legal betting age where
            you live.
          </p>
          <p>
            <strong>Use these as a starting point, not a guarantee.</strong> These are the 6 strongest combinations
            our model finds across the entire week&apos;s slate, picked purely by probability -- legs can come from
            different games, and from the same game when that game&apos;s props happen to rank highest. By default
            each parlay below uses legs from a single book you can place as one slip. Check that your book offers
            every leg, at these lines, before you bet.
          </p>
        </div>

        <WeekSection
          title={current ? `Week ${current.week} Parlays` : "This Week's Parlays"}
          subtitle="This week's games haven't been played yet -- these are the model's current best picks, not graded results."
          data={current}
        />

        <WeekSection
          title={previous ? `Week ${previous.week} Parlays` : "Last Week's Parlays"}
          subtitle="What the model would have picked last week, graded against what actually happened."
          data={previous}
        />

        <p className="parlay-note">
          Legs are drawn from every player prop our model scored that week (no top-{PARLAY_POOL_SIZE}-per-game cap,
          unlike a single game&apos;s Parlay Helper tab), ranked purely by the model&apos;s own probability. Chance to
          hit multiplies each leg&apos;s probability and assumes the legs are independent. Payout is the total
          returned on a $1 bet, including your $1 stake, estimated from each leg&apos;s listed odds; sportsbooks price
          parlays themselves, so the real payout is usually lower.
        </p>
      </main>
    </>
  );
}
