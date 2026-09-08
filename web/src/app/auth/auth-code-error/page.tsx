import Link from "next/link";

export default function AuthCodeErrorPage() {
  return (
    <main>
      <div className="form-shell">
        <div className="unlock-card" style={{ maxWidth: "none" }}>
          <span className="lock-icon">⚠️</span>
          <h3>Sign-In Link Didn&apos;t Work</h3>
          <p>
            That confirmation or sign-in link is invalid or has expired. Try
            signing in again, or request a fresh link.
          </p>
          <Link className="btn btn-primary btn-block" href="/signup">
            Back to Sign Up
          </Link>
        </div>
      </div>
    </main>
  );
}
