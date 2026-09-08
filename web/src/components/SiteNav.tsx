"use client";

import Link from "next/link";
import { useUser } from "@/lib/useUser";

// Real auth now (Supabase), replacing the old static site's
// localStorage "sw_member" flag. Deliberately uses real auth only
// (not the dev preview toggle from useMemberPreview) -- the nav must
// always reflect whether you're actually signed in, never a stale
// "preview" flag left on from testing a page's locked/unlocked
// content. Rightmost slot is always exactly one of Profile / Sign In
// -- never both, never neither. Sign-out lives on the Profile page.
export default function SiteNav() {
  const { user } = useUser();

  return (
    <nav className="navbar">
      <Link className="brand" href="/">
        MATRIX<span>SPORTS</span>
      </Link>
      <div className="navbar-links">
        <Link href="/">Home</Link>
        <Link href="/home">Predictions</Link>
        <Link href="/about">About</Link>
        {user ? (
          <Link href="/profile">Profile</Link>
        ) : (
          <Link href="/login">Sign In / Login</Link>
        )}
      </div>
    </nav>
  );
}
