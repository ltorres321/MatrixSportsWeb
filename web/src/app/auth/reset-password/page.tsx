"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Reached only after /auth/callback has already exchanged the reset
// link's code for a real (recovery-type) session -- that session is
// enough on its own to call updateUser, no separate token needed here.
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
              <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
                {submitting ? "Saving..." : "Set New Password"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
