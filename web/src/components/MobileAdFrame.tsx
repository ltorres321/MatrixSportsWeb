import type { ReactNode } from "react";

// A real 300x250 ("Medium Rectangle") ad unit -- the desktop AdFrame
// is 360px wide, which overflows a typical ~320-375px phone screen
// outright, so this isn't the same frame repositioned, it's a
// genuinely smaller, differently-proportioned unit built for mobile.
// Shown inline in the content flow at the same breakpoint where the
// sidebar .promo-rail disappears (see .mobile-ad-wrap in
// globals.css), so anything narrower than an ultra-wide desktop --
// phones, tablets, ordinary laptops -- gets this instead of nothing.
export default function MobileAdFrame({ children }: { children?: ReactNode }) {
  return (
    <div className="mobile-ad-frame">
      <div className="mobile-ad-panel">{children}</div>
    </div>
  );
}
