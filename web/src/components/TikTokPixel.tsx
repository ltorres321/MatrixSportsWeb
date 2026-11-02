"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    ttq?: {
      load: (pixelId: string) => void;
      page: () => void;
      holdConsent: () => void;
      grantConsent: () => void;
      revokeConsent: () => void;
    };
  }
}

const TIKTOK_PIXEL_ID = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID;
const CONSENT_KEY = "matrixsports-analytics-consent";
export const CONSENT_EVENT = "matrixsports-consent-change";

// Same pattern as GoogleAnalytics.tsx and AdSenseScript.tsx: renders
// nothing at all until NEXT_PUBLIC_TIKTOK_PIXEL_ID is set in this
// deploy context, so this ships inert now -- no pixel ID exists yet
// (no TikTok ad spend has started) -- and needs no further deploy
// once one does; just add the value in Netlify. Keep it scoped to
// Production only there, deliberately, same reasoning as
// NEXT_PUBLIC_GA_MEASUREMENT_ID: branch/preview traffic shouldn't
// pollute real pixel data once campaigns are live.
//
// Consent: TikTok's SDK has its own holdConsent/grantConsent/
// revokeConsent calls (its documented GDPR pattern), used here
// instead of Google's "declare denied defaults" approach because
// that's what TikTok's own pixel actually exposes. This reuses the
// single cookie banner already owned by GoogleAnalytics.tsx rather
// than showing a second one -- that component dispatches a
// CONSENT_EVENT custom event on every Accept/Decline click (in
// addition to writing localStorage), and this component listens for
// it so both pixels react to the same one decision, in the same tab,
// immediately. The initial localStorage read covers a returning
// visitor who chose before this component existed on the page.
//
// Deliberately a plain native <script> element for the SDK loader,
// not next/script's <Script> component -- see AdSenseScript.tsx's
// comment for why: next/script doesn't emit literal markup a
// server-side crawler can see, which breaks domain-verification
// checks that read raw page source (TikTok's Events Manager domain
// verification works the same way AdSense's did).
export default function TikTokPixel() {
  const [consent, setConsent] = useState<"unset" | "granted" | "denied">("unset");

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (stored === "granted" || stored === "denied") {
      setConsent(stored);
    }

    function onConsentChange(e: Event) {
      const value = (e as CustomEvent<"granted" | "denied">).detail;
      setConsent(value);
    }
    window.addEventListener(CONSENT_EVENT, onConsentChange);
    return () => window.removeEventListener(CONSENT_EVENT, onConsentChange);
  }, []);

  useEffect(() => {
    if (!window.ttq) return;
    if (consent === "granted") {
      window.ttq.grantConsent();
    } else if (consent === "denied") {
      window.ttq.revokeConsent();
    }
  }, [consent]);

  if (!TIKTOK_PIXEL_ID) return null;

  return (
    <script
      id="tiktok-pixel-init"
      dangerouslySetInnerHTML={{
        __html: `
          !function (w, d, t) {
            w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<e.length;n++)ttq.setAndDefer(e,e[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};

          ttq.load('${TIKTOK_PIXEL_ID}');
          ttq.holdConsent();
          ttq.page();
          }(window, document, 'ttq');
        `,
      }}
    />
  );
}
