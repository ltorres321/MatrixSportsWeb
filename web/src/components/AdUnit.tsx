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
export default function AdUnit({ kind }: AdUnitProps) {
  const slotId = SLOT_IDS[kind];
  if (!ADSENSE_CLIENT_ID || !slotId) return null;

  const ins =
    kind === "rail" ? (
      // Fixed IAB "Half Page" size, matching AdFrame's own 300x600
      // slot-panel exactly -- a real standard size fills better than
      // forcing a responsive unit into a fixed frame.
      <ins
        className="adsbygoogle"
        style={{ display: "inline-block", width: 300, height: 600 }}
        data-ad-client={ADSENSE_CLIENT_ID}
        data-ad-slot={slotId}
      />
    ) : (
      // MobileAdFrame's panel is a non-IAB 7:2 shape, so this is a
      // responsive unit that fills the panel's width instead.
      <ins
        className="adsbygoogle"
        style={{ display: "block", width: "100%" }}
        data-ad-client={ADSENSE_CLIENT_ID}
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    );

  return (
    <>
      {ins}
      {/* Plain script, not next/script -- see AdSenseScript.tsx for why.
          Each manual <ins> needs its own push call; Auto ads' single
          site-wide push (if ever added) is separate from this. */}
      <script
        dangerouslySetInnerHTML={{ __html: "(adsbygoogle = window.adsbygoogle || []).push({});" }}
      />
    </>
  );
}
