import type { ReactNode } from "react";

// The desktop AdFrame is a fixed 360px wide, which overflows a
// typical ~320-375px phone screen outright, so this isn't the same
// frame repositioned, it's a genuinely smaller unit built for
// anything narrower than the ultra-wide desktop breakpoint where the
// sidebar .promo-rail takes over. Its size (see .mobile-ad-frame in
// globals.css) scales fluidly with the actual content column rather
// than one fixed pixel size, so a phone, a tablet, and an ordinary
// laptop each get a proportionate box instead of a phone-sized one
// stranded in a much wider column.
export default function MobileAdFrame({ children }: { children?: ReactNode }) {
  return (
    <div className="mobile-ad-frame">
      <div className="mobile-ad-panel">{children}</div>
    </div>
  );
}
