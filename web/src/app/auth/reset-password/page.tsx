"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

// Reached straight from the reset-password email link (see
// forgot-password/actions.ts -- redirectTo points here directly, no
// /auth/callback hop). The Supabase browser client auto-detects the
// "code" query param on this page's URL and exchanges it for a real
// (recovery-type) session on its own; this component just waits for
// that to finish before letting the form submit.
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // undefined = still checking the link, true = good to go, false = bad/expired link
  const [ready, setReady] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });

    // Covers the case where detection already finished by the time
    // this listener attaches -- a real race with the client's own
    // auto-exchange, not just defensive padding.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });

    const timeout = setTimeout(() => setReady((r) => r ?? false), 4000);

    return () => {
      listener.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setNote("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setNote("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (error) {
      setNote(error.message);
      return;
    }

    router.push("/home");
    router.refresh();
  }

  if (ready === false) {
    return (
      <main>
        <div className="form-shell">
          <div className="unlock-card" style={{ maxWidth: "none" }}>
            <span className="lock-icon">⚠️</span>
            <h3>Reset Link Didn&apos;t Work</h3>
            <p>That link is invalid or has expired. Request a fresh one below.</p>
            <Link className="btn btn-primary btn-block" href="/forgot-password">
              Request a New Link
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="form-shell">
        <div className="form-panel">
          <h2>Set a New Password</h2>
          <p className="form-intro">Choose a new password for your account.</p>

          <form className="form-grid" onSubmit={handleSubmit}>
            {note && (
              <p className="form-footer-note" style={{ color: "var(--red)" }}>
                {note}
              </p>
            )}
            <div className="field">
              <label htmlFor="new-password">New Password</label>
              <input
                type="password"
                id="new-password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="confirm-password">Confirm New Password</label>
              <input
                type="password"
                id="confirm-password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <div className="field full">
              <button
                type="submit"
                className="btn btn-primary btn-block"
                disabled={submitting || ready === undefined}
              >
                {ready === undefined ? "Checking link..." : submitting ? "Saving..." : "Set New Password"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
