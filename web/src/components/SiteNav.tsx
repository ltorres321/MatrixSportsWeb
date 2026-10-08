"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Real auth is resolved server-side by the root layout on every
// request (see layout.tsx) and passed down as a plain prop -- this
// component itself never re-checks auth, only menu open/closed state
// needs to be client-side. See layout.tsx's comment for why a
// client-side auth check here specifically caused the old "still
// shows Sign In after logging in" bug. isAdmin follows the same
// pattern (layout.tsx checks admin_users server-side via
// getCurrentAdminUserId()) so the link only ever appears for a real
// admin, never flashes for a moment before hiding.

// Fallback scroll depth for pages with no .page-tab-strip at all (the
// homepage, /about, /stories, ...) -- SiteNav renders in the root
// layout, so it has no way to know a given page's shape beyond
// checking the DOM for that element. On a game page (the one this
// whole feature was built for), the real threshold below is computed
// live from the tab strip's own position instead of this constant.
const RAIL_SCROLL_FALLBACK_THRESHOLD = 900;

// About/Contact Us/Sign-In-or-Profile/Admin, consolidated 2026-10 out
// of the top-level link list (too many for a slim bar) into this one
// dropdown. Rendered twice -- once inside the top bar, once inside the
// side rail (2026-10b) -- each a fully independent instance (own
// open state, own outside-click ref) since only one is ever visible
// at a time (CSS hides whichever bar isn't active), so there's no
// need to share state between them.
function MoreMenu({ signedIn, isAdmin, onNavigate }: { signedIn: boolean; isAdmin: boolean; onNavigate: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className={`nav-more ${open ? "open" : ""}`} ref={ref}>
      <button
        type="button"
        className="nav-more-trigger"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="nav-more-trigger-icon">
          <MenuDotsIcon />
        </span>
        <span className="nav-more-trigger-label">
          Menu
          <span className="nav-more-caret" aria-hidden="true">
            &#9662;
          </span>
        </span>
      </button>
      <div className="nav-more-panel">
        <Link
          href="/about"
          onClick={() => {
            close();
            onNavigate();
          }}
        >
          About
        </Link>
        <Link
          href="/contact"
          onClick={() => {
            close();
            onNavigate();
          }}
        >
          Contact Us
        </Link>
        {signedIn ? (
          <Link
            href="/profile"
            onClick={() => {
              close();
              onNavigate();
            }}
          >
            My Profile
          </Link>
        ) : (
          <Link
            href="/login"
            onClick={() => {
              close();
              onNavigate();
            }}
          >
            Sign In / Login
          </Link>
        )}
        {isAdmin && (
          <>
            <div className="nav-more-divider" />
            <Link
              href="/admin/time"
              onClick={() => {
                close();
                onNavigate();
              }}
            >
              Admin: Time
            </Link>
            <Link
              href="/admin/stories"
              onClick={() => {
                close();
                onNavigate();
              }}
            >
              Admin: Stories
            </Link>
            <Link
              href="/admin/social"
              onClick={() => {
                close();
                onNavigate();
              }}
            >
              Admin: Social
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

// Minimal hand-rolled icons, not a library -- 3 glyphs don't justify a
// new dependency. Stroke-based, currentColor, so they inherit the
// rail's own hover/active color for free.
function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9h12v-9" />
    </svg>
  );
}

function PredictionsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20V13" />
      <path d="M10 20V7" />
      <path d="M16 20v-5" />
      <path d="M3 20h18" />
    </svg>
  );
}

function RecapsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="3.5" width="14" height="17" rx="1.5" />
      <path d="M8.5 8h7M8.5 12h7M8.5 16h4" />
    </svg>
  );
}

function MenuDotsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5.5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="18.5" r="1.8" />
    </svg>
  );
}

// Fixed, icon-only, desktop-only (see globals.css's min-width gate on
// .side-rail.visible): the top bar's replacement once you've scrolled
// past the hero -- see RAIL_SCROLL_THRESHOLD. Phones never show this;
// .navbar there is untouched regardless of scroll position.
function SideRail({ signedIn, isAdmin }: { signedIn: boolean; isAdmin: boolean }) {
  return (
    <nav className="side-rail" aria-label="Quick navigation">
      <Link href="/">
        <HomeIcon />
        <span>Home</span>
      </Link>
      <Link href="/home">
        <PredictionsIcon />
        <span>Predictions</span>
      </Link>
      <Link href="/stories">
        <RecapsIcon />
        <span>Recaps</span>
      </Link>
      <MoreMenu signedIn={signedIn} isAdmin={isAdmin} onNavigate={() => {}} />
    </nav>
  );
}

export default function SiteNav({ signedIn, isAdmin }: { signedIn: boolean; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const navRef = useRef<HTMLElement>(null);
  // SiteNav lives in the root layout, which Next.js keeps mounted
  // across client-side navigations -- without this as an effect
  // dependency below, the tab-strip measurement would only ever run
  // once (whichever page loaded first) and go stale the moment someone
  // clicks from one game page to another.
  const pathname = usePathname();

  // Mutates document.body's class directly instead of React state --
  // this fires on every scroll tick, and globals.css's
  // .game-sticky-bar/.page-tab-strip need to see the same flag (to
  // stick at top:0 instead of leaving a navbar-height gap once the top
  // bar is gone) without this component re-rendering GameDetailView's
  // whole subtree, or threading scroll state through props/context for
  // a component two levels away with no other reason to know about it.
  // The bar fades out via opacity (CSS), not display:none, to keep its
  // layout slot reserved -- aria-hidden here keeps it out of the
  // accessibility tree in the same moment, so a screen reader doesn't
  // land on invisible, unclickable links while it's faded out. Only
  // matters in globals.css's 769-1899px range in practice (outside it,
  // mobile never gets the opacity rule and >=1900px deliberately never
  // engages this feature at all -- see .side-rail's own comment on
  // why), so this is a no-op everywhere else regardless of scroll
  // position.
  //
  // THRESHOLD: not a guessed pixel constant -- measured from
  // .page-tab-strip's own natural (pre-scroll) position, the exact
  // point its own position:sticky would otherwise engage, so the
  // handoff always lands right at "about to reach the tabs," however
  // long a given page's injury report/props table makes the scroll
  // (request 2026-10: the fixed 320px guess handed off too early, well
  // before the tabs, while still over the hero/charts area where a
  // page's ad placements live). Falls back to a flat constant on pages
  // with no tab strip at all (the homepage, /about, ...). Measured
  // once on mount, before any scrolling -- .page-tab-strip is itself
  // position:sticky, so reading its rect mid-scroll after it's already
  // engaged would report its current stuck position, not its true
  // document offset.
  useEffect(() => {
    const tabStrip = document.querySelector(".page-tab-strip");
    const threshold = tabStrip
      ? tabStrip.getBoundingClientRect().top + window.scrollY
      : RAIL_SCROLL_FALLBACK_THRESHOLD;

    let ticking = false;
    const apply = () => {
      const past = window.scrollY > threshold;
      document.body.classList.toggle("nav-rail-mode", past);
      navRef.current?.setAttribute("aria-hidden", past ? "true" : "false");
      ticking = false;
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.body.classList.remove("nav-rail-mode");
    };
  }, [pathname]);

  return (
    <>
      <nav className="navbar" ref={navRef}>
        <Link className="brand" href="/" onClick={close}>
          {/* eslint-disable-next-line @next/next/no-img-element -- fixed brand asset, next/image adds no benefit here */}
          <img className="brand-logo" src="/assets/brand/mx-logo.png" alt="" width={32} height={32} />
          MATRIX<span>SPORTS</span>
          <span className="brand-tld">.NET</span>
        </Link>

        <button
          type="button"
          className="nav-toggle"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>

        <div className={`navbar-links ${open ? "open" : ""}`}>
          <Link href="/" onClick={close}>
            Home
          </Link>
          <Link href="/home" onClick={close}>
            Predictions
          </Link>
          <Link href="/stories" onClick={close}>
            Recaps
          </Link>
          <MoreMenu signedIn={signedIn} isAdmin={isAdmin} onNavigate={close} />
        </div>
      </nav>

      <SideRail signedIn={signedIn} isAdmin={isAdmin} />
    </>
  );
}
