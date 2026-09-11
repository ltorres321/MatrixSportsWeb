import AdFrame from "@/components/AdFrame";

type AdRailProps = {
  side: "left" | "right";
};

// 2 stacked ad spots per side. Absolutely (not fixed-) positioned in
// globals.css just outside the .page column, so they scroll with the
// page like real below-the-fold inventory instead of floating pinned
// in place -- and only rendered once the viewport is wide enough for
// two real 360x720 frames to clear the content (see the media query
// there); a real 300x600 ad unit doesn't get to shrink to fit.
export default function AdRail({ side }: AdRailProps) {
  return (
    <div className={`promo-rail promo-rail-${side}`} aria-hidden="true">
      <AdFrame>
        <span className="slot-label">Ad space</span>
      </AdFrame>
      <AdFrame>
        <span className="slot-label">Ad space</span>
      </AdFrame>
    </div>
  );
}
