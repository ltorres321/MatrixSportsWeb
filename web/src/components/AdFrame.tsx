import type { ReactNode } from "react";

type AdFrameProps = {
  children?: ReactNode;
};

// The approved Matrix-HUD border, sized around a real IAB ad unit --
// 300x600 ("Half Page"), one of the sizes Google/most ad networks can
// actually fill -- rather than an invented dimension nothing would
// serve into. The 360x720 frame wraps that unit with a 30px/60px
// margin for the border art itself. Swap the placeholder .slot-panel
// content for a real <ins class="adsbygoogle"> (or a story teaser)
// without touching the frame.
export default function AdFrame({ children }: AdFrameProps) {
  return (
    <div className="matrix-panel">
      <svg
        className="matrix-frame"
        viewBox="0 0 360 720"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="matrixAdBackground">
            <stop offset="0" stopColor="#003315" />
            <stop offset="1" stopColor="#000a04" />
          </radialGradient>

          <filter id="matrixAdGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="3" />
          </filter>

          <path
            id="matrixAdFramePath"
            d="
              M 46 12 H 314 L 342 40
              V 292 L 350 302 V 418 L 342 428
              V 680 L 314 708 H 46 L 18 680
              V 428 L 10 418 V 302 L 18 292
              V 40 Z
            "
          />

          <g id="matrixAdLeftTraces" fill="none">
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

        <path fill="url(#matrixAdBackground)" d="M0 0H360V720H0Z" />

        <use
          href="#matrixAdFramePath"
          fill="none"
          stroke="#26ff64"
          strokeWidth="3"
          opacity="0.55"
          filter="url(#matrixAdGlow)"
        />

        <use href="#matrixAdFramePath" fill="none" stroke="#53ff79" strokeWidth="0.8" />

        <g stroke="#28c858" strokeWidth="0.6" opacity="0.85">
          <use href="#matrixAdLeftTraces" />
          <use href="#matrixAdLeftTraces" transform="translate(360 0) scale(-1 1)" />
        </g>

        <g fill="#7aff98" filter="url(#matrixAdGlow)">
          <circle cx="46" cy="12" r="4" />
          <circle cx="314" cy="12" r="4" />
          <circle cx="46" cy="708" r="4" />
          <circle cx="314" cy="708" r="4" />
        </g>

        <g fill="#c9ffd5">
          <circle cx="46" cy="12" r="1.8" />
          <circle cx="314" cy="12" r="1.8" />
          <circle cx="46" cy="708" r="1.8" />
          <circle cx="314" cy="708" r="1.8" />
        </g>

        <g fill="#9affb4">
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
      </svg>

      <div className="slot-panel">{children}</div>
    </div>
  );
}
