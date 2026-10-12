"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const CONSENT_KEY = "matrixsports-analytics-consent";

// Google's Consent Mode v2 pattern: gtag.js loads unconditionally
// (harmless on its own -- it defaults all four storage types to
// "denied", so no cookie is set until a visitor actually opts in).
// ad_storage/ad_user_data/ad_personalization default to "denied"
// alongside analytics_storage, not just the latter -- required for
// Google Ads (AdSense) in the EU/EEA since March 2024, and this site
// does run AdSense (see AdSenseScript.tsx). A "granted" choice saved
// from an earlier visit re-applies the grant on this load; "denied"
// or no choice yet leaves it off and shows the banner. Renders
// nothing at all if NEXT_PUBLIC_GA_MEASUREMENT_ID isn't set in this
// deploy context -- see Netlify env var scoping so branch previews
// don't pollute real production analytics.
export default function GoogleAnalytics() {
  const [consent, setConsent] = useState<"unset" | "granted" | "denied">("unset");

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (stored === "granted" || stored === "denied") {
      setConsent(stored);
    }
  }, []);

  useEffect(() => {
    if (consent === "granted" && typeof window.gtag === "function") {
      window.gtag("consent", "update", {
        analytics_storage: "granted",
        ad_storage: "granted",
        ad_user_data: "granted",
        ad_personalization: "granted",
      });
    }
  }, [consent]);

  if (!GA_MEASUREMENT_ID) return null;

  function choose(value: "granted" | "denied") {
    localStorage.setItem(CONSENT_KEY, value);
    setConsent(value);
  }

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('consent', 'default', {
            analytics_storage: 'denied',
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied'
          });
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}');
        `}
      </Script>

      {consent === "unset" && (
        <div className="cookie-banner" role="dialog" aria-label="Cookie consent">
          <p>
            We use cookies to understand how visitors use this site. See our <a href="/privacy">Privacy Policy</a>.
          </p>
          <div className="cookie-banner-actions">
            <button type="button" className="btn btn-ghost" onClick={() => choose("denied")}>
              Decline
            </button>
            <button type="button" className="btn btn-primary" onClick={() => choose("granted")}>
              Accept
            </button>
          </div>
        </div>
      )}
    </>
  );
}
