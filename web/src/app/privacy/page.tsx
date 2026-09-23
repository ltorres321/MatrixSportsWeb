import Link from "next/link";

// A working draft, not a substitute for a lawyer's review -- it's
// written to genuinely describe what this site does today (Supabase
// auth, optional phone verification, Google Analytics, Google AdSense)
// and what's still to come (sportsbook affiliate links). Google
// Analytics and AdSense went live 2026-09-23 -- the sections below
// were updated from "once enabled" to present tense at the same time,
// since an AdSense reviewer reading "may display ads" on a page that
// already has ads running is exactly the kind of inaccurate
// declaration the Program Policies ask publishers not to make.
export const metadata = {
  title: "Privacy Policy — Matrix Sports Analytics",
};

export default function PrivacyPage() {
  return (
    <>
      <header className="site-header">
        <h1 className="glow">PRIVACY POLICY</h1>
        <p className="subtitle">{"// last updated September 2026"}</p>
      </header>

      <main className="about-main">
        <section className="about-block">
          <div className="section-label">
            <span className="dot" /> OVERVIEW
          </div>
          <p>
            This policy explains what information Matrix Sports Analytics
            (&quot;we,&quot; &quot;us&quot;) collects when you use
            matrixsports.net, why we collect it, and the choices you have
            about it. Using the site means you&apos;ve read this policy.
          </p>
        </section>

        <section className="about-block">
          <div className="section-label">
            <span className="dot" /> INFORMATION WE COLLECT
          </div>
          <p>
            <strong>Account information.</strong> If you create an account, we
            store your email address, and optionally your name and phone
            number if you choose to verify it. Authentication is handled by
            Supabase; we never see or store your password in readable form.
          </p>
          <p>
            <strong>Preferences.</strong> Theme choice, followed teams, and
            notification settings you set on your Profile page are stored
            against your account so they persist across visits.
          </p>
          <p>
            <strong>Usage data.</strong> We use Google Analytics to collect
            information about how you use the site — pages viewed, links
            clicked, approximate location from IP address, device and browser
            type. This is used in aggregate to understand what&apos;s
            working, not to identify you personally.
          </p>
          <p>
            <strong>Cookies.</strong> We use cookies to keep you signed in
            between visits. Google and our advertising partners (currently
            Google AdSense) also set cookies to measure site usage and ad
            performance — see the Advertising section below.
          </p>
        </section>

        <section className="about-block">
          <div className="section-label">
            <span className="dot" /> HOW WE USE INFORMATION
          </div>
          <p>
            To operate your account and remember your preferences; to send
            you prediction emails you&apos;ve opted into; to understand and
            improve the site; and to keep the service secure and working
            correctly. We do not sell your personal information.
          </p>
        </section>

        <section className="about-block">
          <div className="section-label">
            <span className="dot" /> ADVERTISING &amp; AFFILIATE LINKS
          </div>
          <p>
            This site displays ads served by Google AdSense, and may in the
            future include affiliate links to sportsbooks and other partners
            (none are live yet). If you click an ad or, once live, an
            affiliate link, you leave our site, and the destination
            site&apos;s own privacy policy and terms apply — we don&apos;t
            control what they collect. Any referral fee or commission from
            future affiliate links won&apos;t cost you anything extra and
            won&apos;t affect what predictions or content we show you.
          </p>
          <p>
            Advertising and analytics providers use cookies or similar
            technology to serve relevant ads and measure their performance.
            You can control or disable cookies through your browser settings,
            though some parts of the site (like staying signed in) may not
            work properly if you disable cookies entirely.
          </p>
          <p>
            Sports betting is only legal in certain jurisdictions and only
            for people who meet the applicable minimum age (21 in most
            states that allow it). If gambling is a problem for you or
            someone you know, contact the National Council on Problem
            Gambling at 1-800-GAMBLER.
          </p>
        </section>

        <section className="about-block">
          <div className="section-label">
            <span className="dot" /> THIRD-PARTY SERVICES WE USE
          </div>
          <p>
            Supabase (accounts, authentication, database), Twilio (phone
            verification, if you choose to add a phone number), Resend
            (transactional and prediction emails), Google Analytics, and
            Google AdSense. Game and score data comes from public sports
            data providers (including ESPN and TheSportsDB); no personal
            information is shared with
            them.
          </p>
        </section>

        <section className="about-block">
          <div className="section-label">
            <span className="dot" /> DATA RETENTION &amp; SECURITY
          </div>
          <p>
            We keep account information for as long as your account exists,
            and delete it if you delete your account. We use industry-standard
            safeguards (encrypted connections, managed authentication) but no
            system is 100% secure — we can&apos;t guarantee absolute
            protection against every possible breach.
          </p>
        </section>

        <section className="about-block">
          <div className="section-label">
            <span className="dot" /> YOUR CHOICES
          </div>
          <p>
            You can review and change most of your stored information from
            your Profile page, including notification preferences and theme.
            To delete your account or request a copy of your data, contact us
            using the email below. You can opt out of marketing/prediction
            emails at any time via the unsubscribe link in those emails or
            from your Profile settings.
          </p>
        </section>

        <section className="about-block">
          <div className="section-label">
            <span className="dot" /> CHILDREN&apos;S PRIVACY
          </div>
          <p>
            This site is not directed at children under 13, and we don&apos;t
            knowingly collect information from them. If you believe a child
            has created an account, contact us and we&apos;ll remove it.
          </p>
        </section>

        <section className="about-block">
          <div className="section-label">
            <span className="dot" /> CHANGES TO THIS POLICY
          </div>
          <p>
            We may update this policy as the site changes. Meaningful changes
            will be reflected by updating the date at the top of this page.
          </p>
        </section>

        <section className="about-block">
          <div className="section-label">
            <span className="dot" /> CONTACT
          </div>
          <p>
            Questions about this policy or your data: reach us via our{" "}
            <Link href="/contact" className="gold-cta-link">Contact Us</Link> page. See also our{" "}
            <Link href="/about">About page</Link> for how the prediction
            model itself works.
          </p>
        </section>
      </main>

      <footer className="site-footer">
        <p>
          This page is a working draft describing our actual practices, not a
          substitute for professional legal advice.
        </p>
      </footer>
    </>
  );
}
