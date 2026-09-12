import Link from "next/link";

// A working draft, not a substitute for a lawyer's review -- it's
// written to genuinely describe what this site does today (Supabase
// auth, optional phone verification) and what's about to be wired in
// (Google Analytics, display ads, sportsbook affiliate links), since
// both AdSense/Ezoic approval and Analytics' cookie consent need a
// real policy in place before those go live, not after.
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
            <strong>Usage data.</strong> Once analytics is enabled on this
            site, we (via Google Analytics) collect information about how you
            use the site — pages viewed, links clicked, approximate location
            from IP address, device and browser type. This is used in
            aggregate to understand what&apos;s working, not to identify you
            personally.
          </p>
          <p>
            <strong>Cookies.</strong> We use cookies to keep you signed in
            between visits. Once analytics and advertising are enabled,
            Google and our advertising partners may also set cookies to
            measure site usage and ad performance — see the Advertising
            section below.
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
            This site may display ads served by third-party advertising
            networks (such as Google AdSense or Ezoic), and may include
            affiliate links to sportsbooks and other partners. If you click
            an ad or an affiliate link, you leave our site, and the
            destination site&apos;s own privacy policy and terms apply — we
            don&apos;t control what they collect. We may receive a referral
            fee or commission for some of these links; that doesn&apos;t cost
            you anything extra and doesn&apos;t affect what predictions or
            content we show you.
          </p>
          <p>
            Advertising and analytics providers may use cookies or similar
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
            (transactional and prediction emails), and — once enabled —
            Google Analytics and one or more advertising networks. Game and
            score data comes from public sports data providers (including
            ESPN and TheSportsDB); no personal information is shared with
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
            Questions about this policy or your data: reach us at{" "}
            <a href="mailto:privacy@matrixsports.net">privacy@matrixsports.net</a>
            . See also our <Link href="/about">About page</Link> for how the
            prediction model itself works.
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
