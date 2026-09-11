import Link from "next/link";

// Real auth now (Supabase). Resolved server-side by the root layout
// on every request (see layout.tsx) and passed down as a plain prop
// -- NOT a client-side hook -- because this component lives in the
// persistent layout shell, which never remounts on an in-app
// navigation. A client hook here would only ever check auth once per
// full page load, so it kept showing "Sign In / Login" after signing
// in until a hard refresh. Rightmost slot is always exactly one of
// My Profile / Sign In -- never both, never neither. Sign-out lives
// on the Profile page.
export default function SiteNav({ signedIn }: { signedIn: boolean }) {
  return (
    <nav className="navbar">
      <Link className="brand" href="/">
        MATRIX<span>SPORTS</span>
      </Link>
      <div className="navbar-links">
        <Link href="/">Home</Link>
        <Link href="/home">Predictions</Link>
        <Link href="/about">About</Link>
        {signedIn ? (
          <Link href="/profile">My Profile</Link>
        ) : (
          <Link href="/login">Sign In / Login</Link>
        )}
      </div>
    </nav>
  );
}
