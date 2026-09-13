import Script from "next/script";

const ADSENSE_CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

// Same pattern as GoogleAnalytics.tsx: renders nothing at all until
// NEXT_PUBLIC_ADSENSE_CLIENT_ID is set as an env var, so this ships
// inert now and needs no further deploy once the AdSense account
// exists -- just add the value in Netlify. Loads unconditionally
// (not gated behind the cookie-consent banner like GA4's actual
// tracking) because Google's site-verification check during AdSense
// review needs the script reliably present in the page source; ad
// personalization consent is handled by Google's own consent
// signals once real ad units are placed, not by whether this script
// tag loaded.
export default function AdSenseScript() {
  if (!ADSENSE_CLIENT_ID) return null;

  return (
    <Script
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  );
}
