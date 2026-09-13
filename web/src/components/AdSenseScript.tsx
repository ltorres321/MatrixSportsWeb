const ADSENSE_CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

// Same pattern as GoogleAnalytics.tsx: renders nothing at all until
// NEXT_PUBLIC_ADSENSE_CLIENT_ID is set as an env var, so this ships
// inert now and needs no further deploy once the AdSense account
// exists -- just add the value in Netlify.
//
// Deliberately a plain native <script> element, NOT next/script's
// <Script> component. Every next/script strategy in this Next.js
// version (confirmed for both afterInteractive and beforeInteractive)
// registers the URL through an internal `__next_s` queue rather than
// emitting literal <script src="..."> markup -- fine for a real
// browser, but Google's AdSense site-verification check failed
// against it, and a plain HTML element is the one thing guaranteed to
// render as exactly the literal tag Google's own instructions say to
// paste into <head>.
export default function AdSenseScript() {
  if (!ADSENSE_CLIENT_ID) return null;

  return (
    <script
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
      crossOrigin="anonymous"
    />
  );
}
