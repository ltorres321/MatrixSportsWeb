"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const ADSENSE_CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

// One AdSense manual display unit per physical shape the site's frames
// come in -- "rail" for the fixed 300x600 desktop AdFrame, "mobile" for
// the variable-width, non-IAB-standard MobileAdFrame. Each is its own
// ad unit in the AdSense dashboard (its own data-ad-slot), reused across
// every placement of that shape on the site -- Google explicitly allows
// repeating one ad unit's slot ID many times on a page/site, so this
// doesn't need a slot ID per individual placement in page.tsx et al.
const SLOT_IDS = {
  rail: process.env.NEXT_PUBLIC_ADSENSE_SLOT_RAIL,
  mobile: process.env.NEXT_PUBLIC_ADSENSE_SLOT_MOBILE,
} as const;

type AdUnitProps = {
  kind: keyof typeof SLOT_IDS;
};

// Renders nothing -- leaving AdFrame/MobileAdFrame's decorative frame
// showing an empty (still-in-beta-looking) box, same as today -- until
// both the site-wide client ID (AdSenseScript.tsx) and this shape's own
// slot ID are configured. Same ships-inert-until-configured pattern as
// every other optional integration in this codebase.
//
// This is a *manual* ad unit, not Auto ads: it renders into the exact
// spot AdFrame/MobileAdFrame already reserve in the layout, rather than
// relying on Google's Auto ads placement scanner to notice and fill
// those spots on its own (it generally won't -- Auto ads injects its
// own containers wherever its own heuristics prefer, ignoring custom
// decorative frames like these). Auto ads can still be left on in the
// AdSense dashboard on top of this; the two aren't mutually exclusive.
//
// The push() call happens in an effect, not an inline <script> sibling
// of the <ins>. AdSense's own docs snippet is a plain <script> right
// after the <ins>, which works on a static page -- but this page
// hydrates: React reconciles the server-rendered <ins> against its own
// tree, and a literal inline script can end up executing before that
// settles (or, with several of these repeated on one page, racing each
// other). Google's script then can't find the <ins> it's supposed to
// fill and throws "no_div". Pushing from useEffect instead guarantees
// the <ins> is actually committed to the DOM first, every time.
export default function AdUnit({ kind }: AdUnitProps) {
  const slotId = SLOT_IDS[kind];

  useEffect(() => {
    if (!ADSENSE_CLIENT_ID || !slotId) return;

    // One more frame's delay before push(), not just "after commit" --
    // a responsive unit's container (the mobile slot, sized via
    // percentage inset inside an aspect-ratio box) can still measure
    // 0-width right at commit time if layout hasn't fully settled yet,
    // which throws "No slot size for availableWidth=0". rAF waits for
    // that to finish first. requestAnimationFrame's own cleanup also
    // naturally dedupes StrictMode's dev-only mount/unmount/remount
    // cycle down to exactly one real push, same as a ref guard would,
    // without needing one.
    const id = requestAnimationFrame(() => {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch {
        // adsbygoogle.js can throw synchronously (availableWidth=0
        // above, "no_div", or other internal AdSense edge cases).
        // A third-party ad script failing must never take down the
        // page -- left uncaught, this would propagate out of the
        // effect and trip Next's error boundary for the whole route.
      }
    });

    return () => cancelAnimationFrame(id);
  }, [slotId]);

  if (!ADSENSE_CLIENT_ID || !slotId) return null;

  if (kind === "rail") {
    // Fixed IAB "Half Page" size, matching AdFrame's own 300x600
    // slot-panel exactly -- a real standard size fills better than
    // forcing a responsive unit into a fixed frame.
    return (
      <ins
        className="adsbygoogle"
        style={{ display: "inline-block", width: 300, height: 600 }}
        data-ad-client={ADSENSE_CLIENT_ID}
        data-ad-slot={slotId}
      />
    );
  }

  // MobileAdFrame's panel is a non-IAB 7:2 shape, so this is a
  // responsive unit that sizes itself to the panel's own width.
  // Deliberately NOT data-full-width-responsive -- that flag tells
  // Google's script to size against a *wider ancestor* instead of
  // this ins's immediate container, specifically so an ad can break
  // out of a narrow sidebar to look "full width" on a traditional
  // content site. Here the immediate container (.mobile-ad-panel) is
  // the actual intended size; with the flag on, the ad ignored that
  // entirely and rendered at roughly the page's content width,
  // spilling out past the decorative frame's border on every side.
  return (
    <ins
      className="adsbygoogle"
      style={{ display: "block", width: "100%" }}
      data-ad-client={ADSENSE_CLIENT_ID}
      data-ad-slot={slotId}
      data-ad-format="auto"
    />
  );
}
