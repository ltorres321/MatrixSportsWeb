// Ahrefs Web Analytics: cookieless, no personal data collected (per
// Ahrefs' own description), so unlike GoogleAnalytics.tsx this
// doesn't need to sit behind the cookie-consent gate -- it has
// nothing to ask consent for. A plain literal <script> tag (not
// next/script's <Script> component) for the same reason as
// AdSenseScript.tsx and the GoogleAnalytics.tsx consent-default
// script: next/script registers the URL through a client-side queue
// instead of emitting markup, invisible to any crawler reading raw
// HTML. Renders nothing at all if NEXT_PUBLIC_AHREFS_ANALYTICS_KEY
// isn't set in this deploy context -- same "ships inert" pattern as
// the other optional analytics/ads keys, and deliberately only set in
// Netlify's Production scope, not Branch deploys, so preview/dev
// traffic doesn't pollute the real numbers (see .env.example).
const AHREFS_ANALYTICS_KEY = process.env.NEXT_PUBLIC_AHREFS_ANALYTICS_KEY;

export default function AhrefsAnalytics() {
  if (!AHREFS_ANALYTICS_KEY) return null;

  return <script src="https://analytics.ahrefs.com/analytics.js" data-key={AHREFS_ANALYTICS_KEY} async />;
}
