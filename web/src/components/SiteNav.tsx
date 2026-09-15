"use client";

import { useState } from "react";
import Link from "next/link";

// Real auth is resolved server-side by the root layout on every
// request (see layout.tsx) and passed down as a plain prop -- this
// component itself never re-checks auth, only the mobile menu's
// open/closed state needs to be client-side. See layout.tsx's comment
// for why a client-side auth check here specifically caused the old
// "still shows Sign In after logging in" bug. isAdmin follows the
// same pattern (layout.tsx checks admin_users server-side via
// getCurrentAdminUserId()) so the link only ever appears for a real
// admin, never flashes for a moment before hiding.
export default function SiteNav({ signedIn, isAdmin }: { signedIn: boolean; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <nav className="navbar">
      <Link className="brand" href="/" onClick={close}>
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
        <Link href="/about" onClick={close}>
          About
        </Link>
        <Link href="/contact" onClick={close}>
          Contact Us
        </Link>
        {signedIn ? (
          <Link href="/profile" onClick={close}>
            My Profile
          </Link>
        ) : (
          <Link href="/login" onClick={close}>
            Sign In / Login
          </Link>
        )}
        {isAdmin && (
          <>
            <Link href="/admin/time" onClick={close}>
              Admin: Time
            </Link>
            <Link href="/admin/stories" onClick={close}>
              Admin: Stories
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
