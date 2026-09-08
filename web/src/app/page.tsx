import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSeasons, getCurrentSeasonYear, CURRENT_WEEK } from "@/lib/matchups";
import { teamLogoPath, TEAMS } from "@/lib/teams";
import MatchupCard from "@/components/MatchupCard";
import { getEspnNflNews, type NewsItem } from "@/lib/espnNews";

// Signed-out visitors get the marketing pitch below. Signed-in users
// get a real dashboard instead -- see SignedInDashboard.
export default async function HomePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (data.user) {
    const firstName = (data.user.user_metadata?.first_name as string | undefined) ?? undefined;
    const news = await getEspnNflNews(6);
    return <SignedInDashboard firstName={firstName} news={news} />;
  }

  return (
    <>
      <main>
        <section className="hero">
          <div className="hero-eyebrow">
            <span className="dot"></span> FREE DURING BETA
          </div>
          <h1 className="hero-title">
            SEE THE GAME
            <br />
            <span>BEFORE IT&apos;S PLAYED</span>
          </h1>
          <p className="hero-sub">
            Matrix Sports Analytics simulates every NFL matchup 100,000 times,
            grounded in the real betting line — not a boosted number. Free
            model picks for early users, every week.
          </p>
          <div className="hero-actions">
            <Link className="btn btn-primary" href="/home">
              View This Week&apos;s Free Pick
            </Link>
            <Link className="btn btn-ghost" href="/signup">
              Get Early Access — Free
            </Link>
          </div>
          <p className="hero-note">No credit card required. Cancel anytime — it&apos;s free.</p>
        </section>

        <div className="value-grid">
          <div className="value-card">
            <span className="icon">🎯</span>
            <h3>Model-Driven Probabilities</h3>
            <p>Every matchup gets a simulated win probability, refreshed as the market line moves.</p>
          </div>
          <div className="value-card">
            <span className="icon">🔓</span>
            <h3>One Free Game a Week</h3>
            <p>Anyone can view our marquee Game of the Week. Sign up free to see the full slate.</p>
          </div>
          <div className="value-card">
            <span className="icon">🏷️</span>
            <h3>Early Subscriber Pricing</h3>
            <p>Free accounts created now lock in preferential pricing when paid tiers launch later.</p>
          </div>
        </div>

        <div className="pricing-strip">
          <span>
            🔒 Early subscribers get <strong>preferential pricing</strong> — sign up free
            during beta to lock in your rate before paid tiers launch.
          </span>
          <Link className="btn btn-primary" href="/signup">
            Claim Your Spot
          </Link>
        </div>
      </main>

      <footer className="site-footer">
        <p>
          Landing page prototype — probabilities referenced above describe the
          product direction and are not live figures. See{" "}
          <Link href="/home">the predictions page</Link> for the current design
          of the game-viewing experience.
        </p>
      </footer>
    </>
  );
}

function SignedInDashboard({ firstName, news }: { firstName?: string; news: NewsItem[] }) {
  const seasons = getSeasons();
  const year = getCurrentSeasonYear();
  const premier = seasons[year].matchups.find((m) => m.premier);
  const logoStrip = TEAMS.slice(0, 12);

  return (
    <>
      <header className="site-header">
        <h1 className="glow">WELCOME BACK{firstName ? `, ${firstName.toUpperCase()}` : ""}</h1>
        <p className="subtitle">{"// your weekly rundown, model insights, and this week's free pick"}</p>
      </header>

      <div className="logo-strip" aria-hidden="true">
        {logoStrip.map((t) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={t.alias} src={teamLogoPath(t.alias)} alt="" />
        ))}
      </div>

      <main>
        {premier && (
          <div className="premier-wrap">
            <div className="premier-ribbon">★ LOCK OF THE WEEK</div>
            <MatchupCard matchup={premier} premier />
            <div style={{ textAlign: "center", marginTop: "1.25rem" }}>
              <Link className="btn btn-ghost" href="/home">
                View Full Week {CURRENT_WEEK} Slate →
              </Link>
            </div>
          </div>
        )}

        {news.length > 0 && (
          <div className="news-section">
            <div className="section-label">
              <span className="dot" /> LATEST NFL NEWS
              <span className="news-credit">via ESPN</span>
            </div>
            <div className="news-grid">
              {news.map((item) => (
                <a key={item.link} className="news-card" href={item.link} target="_blank" rel="noopener noreferrer">
                  {item.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="news-card-image" src={item.image} alt="" />
                  ) : (
                    <div className="news-card-image news-card-image-fallback">🏈</div>
                  )}
                  <div className="news-card-body">
                    <h3>{item.title}</h3>
                    <p>{item.snippet}</p>
                    <span className="read-more">Read on ESPN →</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="section-label">
          <span className="dot" /> INSIGHTS &amp; ARTICLES
        </div>

        <div className="article-grid">
          <Link className="article-card" href="/about">
            <div className="thumb">🧠</div>
            <h3>How We Turned a Betting Line Into 100,000 Simulated Games</h3>
            <p>
              The full story behind the model: why we start from the market
              line, what we tested and cut, and why 100,000 runs beats a
              single guess.
            </p>
            <span className="read-more">Read More →</span>
          </Link>

          <div className="article-card disabled">
            <div className="thumb">📊</div>
            <span className="soon-tag" style={{ position: "absolute", top: "1rem", right: "1rem" }}>
              COMING SOON
            </span>
            <h3>This Week&apos;s Model Insight</h3>
            <p>
              After Week {CURRENT_WEEK} wraps, this space breaks down what the
              simulations got right, what surprised us, and how the numbers
              compared to what actually happened on the field.
            </p>
          </div>

          <div className="article-card disabled">
            <div className="thumb">🏈</div>
            <span className="soon-tag" style={{ position: "absolute", top: "1rem", right: "1rem" }}>
              COMING SOON
            </span>
            <h3>Team Deep Dives</h3>
            <p>
              Season-long trend pieces on individual teams — how their actual
              results have tracked against our simulated projections week
              over week.
            </p>
          </div>
        </div>
      </main>

      <footer className="site-footer">
        <p>
          Article content is being built out — the piece linked above is real,
          the two marked &quot;Coming Soon&quot; will be written from actual
          weekly model output once a full season cycle has run, not filled in
          with placeholder numbers.
        </p>
      </footer>
    </>
  );
}
