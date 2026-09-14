export const metadata = {
  title: "How It Works — Matrix Sports Analytics",
  description:
    "How a Matrix Sports Analytics prediction gets made: the 100,000-run Monte Carlo model, what factors are tested, and what got cut.",
};

export default function AboutPage() {
  return (
    <>
      <header className="site-header">
        <h1 className="glow">WHAT&apos;S ACTUALLY UNDER THE HOOD</h1>
        <p className="subtitle">{"// every number on this site is something we can explain"}</p>
      </header>

      <main className="about-main">
        <section className="about-block">
          <div className="section-label">
            <span className="dot" /> HOW A PREDICTION GETS MADE
          </div>
          <p>
            We don&apos;t start by guessing. Before we simulate a single game, we
            start from the actual point spread and point total that real
            sportsbooks publish before kickoff. That number already reflects
            an enormous amount of information — team news, injuries, public
            opinion, expert analysis, all of it, priced in by people risking
            real money to get it right.
          </p>
          <p>
            From there, we look at decades of real NFL games to measure
            exactly how far final scores have historically landed from that
            opening number. Sometimes the favorite covers easily. Sometimes
            the underdog keeps it close. Sometimes the total blows right past
            expectations. That spread of outcomes is measured history, not a
            guess.
          </p>
          <p>
            Then, instead of handing you one single prediction, we play the
            game out <strong>100,000</strong> different ways — each time
            nudging the score up or down using that same real-world
            variability — and count what actually happens across all of
            them. A team winning 68% of the time isn&apos;t a vibe. It&apos;s a tally.
          </p>
        </section>

        <section className="about-block">
          <div className="section-label">
            <span className="dot" /> WHY START FROM THE BETTING LINE AT ALL?
          </div>
          <p>
            Some sites act like the betting line doesn&apos;t exist, as if a
            purely &quot;independent&quot; prediction is somehow more
            impressive. We think that&apos;s backwards. The market line
            already contains more real-time, real-money-tested information
            than almost anything else available before a game. Ignoring it
            on purpose would make our numbers worse, not better. Our job
            isn&apos;t to replace that number — it&apos;s to test whether we
            can responsibly build on top of it.
          </p>
        </section>

        <section className="about-block">
          <div className="section-label">
            <span className="dot" /> WHAT WE TESTED — AND CUT
          </div>
          <p className="about-intro">
            Not every idea that sounds smart actually helps. Here&apos;s what
            we tested against real outcomes, and were honest about, when it
            didn&apos;t move the needle:
          </p>
          <div className="value-grid">
            <div className="value-card">
              <span className="icon">🌦️</span>
              <h3>Game-Day Weather</h3>
              <p>
                Wind, temperature, precipitation — tested directly against
                real results. Once the betting line was already accounted
                for, weather added nothing measurable. Left out.
              </p>
            </div>
            <div className="value-card">
              <span className="icon">🏟️</span>
              <h3>Indoors vs. Outdoors</h3>
              <p>
                Whether a game was played in a dome made no reliable
                difference either. A real, testable idea — it just didn&apos;t
                hold up. Left out.
              </p>
            </div>
            <div className="value-card">
              <span className="icon">✈️</span>
              <h3>Rest Days &amp; Travel</h3>
              <p>
                Extra rest, cross-country travel, short weeks — a genuine
                hypothesis. It didn&apos;t add anything beyond what the
                betting line already captures. Left out.
              </p>
            </div>
          </div>
          <p className="about-outro">
            None of these were dead ends — they&apos;re proof the process
            works. A model that never says &quot;no&quot; to itself isn&apos;t
            rigorous. It&apos;s just decorated.
          </p>
        </section>

        <section className="about-block">
          <div className="section-label">
            <span className="dot" /> WHY 100,000 GAMES, NOT ONE GUESS
          </div>
          <p>
            Think about flipping a coin. Flip it 10 times and you might get 7
            heads — that doesn&apos;t mean the coin is unfair, it just means
            small samples wobble. Flip it 100,000 times and the result
            settles in close to the true odds. We do the same thing with
            every matchup: instead of one guess dressed up as a percentage,
            we run the game forward 100,000 times and report exactly how
            often each outcome actually happened.
          </p>
        </section>

        <section className="honesty-block">
          <div className="honesty-tag">OUR HONESTY COMMITMENT</div>
          <p>
            We will never round a number up to make it sound better. If the
            honest math says 54%, we show 54% — not a confident-sounding 65%.
            Sports has real randomness in it that no model erases, and
            we&apos;d rather earn your trust with a number you can rely on
            than sell you one that just sounds good.
          </p>
        </section>

        <p className="closing-line">
          Most sites just hand you a percentage and ask you to trust it.
          <br />
          We named this site Matrix because we&apos;d rather show you
          what&apos;s underneath.
        </p>
      </main>

      <footer className="site-footer">
        <p>
          Have a question about how a specific number was produced? Every
          prediction we publish is kept permanently, so we can always show
          our work.
        </p>
      </footer>
    </>
  );
}
