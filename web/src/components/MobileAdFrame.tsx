import type { ReactNode } from "react";

// Same exact frame geometry as AdFrame.tsx's desktop rail unit, reused
// rather than hand-drawn from scratch -- wrapped in a transpose
// transform (matrix(0,1,1,0,0,0), i.e. swap x/y for every point) so
// the portrait 360x720 design becomes a landscape 720x360 one with
// identical corner brackets, glow dots, and edge traces, just rotated
// into the wide shape this slot actually needs. Distinct element ids
// (mobileAd... instead of matrixAd...) are required, not cosmetic --
// AdFrame and this component render on the same page at once (CSS
// media queries pick one, but both exist in the DOM), and SVG <use>
// references would collide across two elements sharing one id.
export default function MobileAdFrame({ children }: { children?: ReactNode }) {
  return (
    <div className="mobile-ad-frame">
      <svg
        className="mobile-ad-frame-svg"
        viewBox="0 0 720 360"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="mobileAdBackground">
            <stop offset="0" stopColor="var(--ad-bg-inner)" />
            <stop offset="1" stopColor="var(--ad-bg-outer)" />
          </radialGradient>

          <filter id="mobileAdGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="3" />
          </filter>

          <path
            id="mobileAdFramePath"
            d="
              M 46 12 H 314 L 342 40
              V 292 L 350 302 V 418 L 342 428
              V 680 L 314 708 H 46 L 18 680
              V 428 L 10 418 V 302 L 18 292
              V 40 Z
            "
          />

          <g id="mobileAdLeftTraces" fill="none">
            <path
              d="M 8 0 V 28 L 3 36 V 292 L 7 300
                 V 344 M 7 376 V 420 L 3 428 V 686 L 22 705 V 720"
            />
            <path
              d="M 35 0 V 17 L 12 40 V 286 L 5 293
                 M 5 427 L 12 434 V 682 L 35 705 V 720"
            />
            <path d="M 50 20 H 98 M 50 700 H 98" />
          </g>
        </defs>

        {/* Every child coordinate below is authored in the original
            360(w)x720(h) space and left untouched -- this single
            transform is what turns the whole thing into the 720x360
            landscape layout, so the portrait design's math never
            needs to be duplicated or re-derived. */}
        <g transform="matrix(0,1,1,0,0,0)">
          <path fill="url(#mobileAdBackground)" d="M0 0H360V720H0Z" />

          <use
            href="#mobileAdFramePath"
            fill="none"
            stroke="var(--ad-glow-color)"
            strokeWidth="3"
            opacity="0.55"
            filter="url(#mobileAdGlow)"
          />

          <use href="#mobileAdFramePath" fill="none" stroke="var(--ad-line-color)" strokeWidth="0.8" />

          <g stroke="var(--ad-trace-color)" strokeWidth="0.6" opacity="0.85">
            <use href="#mobileAdLeftTraces" />
            <use href="#mobileAdLeftTraces" transform="translate(360 0) scale(-1 1)" />
          </g>

          <g fill="var(--ad-dot-glow)" filter="url(#mobileAdGlow)">
            <circle cx="46" cy="12" r="4" />
            <circle cx="314" cy="12" r="4" />
            <circle cx="46" cy="708" r="4" />
            <circle cx="314" cy="708" r="4" />
          </g>

          <g fill="var(--ad-dot-core)">
            <circle cx="46" cy="12" r="1.8" />
            <circle cx="314" cy="12" r="1.8" />
            <circle cx="46" cy="708" r="1.8" />
            <circle cx="314" cy="708" r="1.8" />
          </g>

          <g fill="var(--ad-tick-color)">
            <circle cx="168" cy="12" r="0.7" />
            <circle cx="174" cy="12" r="0.9" />
            <circle cx="180" cy="12" r="1.3" />
            <circle cx="186" cy="12" r="0.9" />
            <circle cx="192" cy="12" r="0.7" />

            <circle cx="168" cy="708" r="0.7" />
            <circle cx="174" cy="708" r="0.9" />
            <circle cx="180" cy="708" r="1.3" />
            <circle cx="186" cy="708" r="0.9" />
            <circle cx="192" cy="708" r="0.7" />
          </g>
        </g>
      </svg>

      <div className="mobile-ad-panel">{children}</div>
    </div>
  );
}
