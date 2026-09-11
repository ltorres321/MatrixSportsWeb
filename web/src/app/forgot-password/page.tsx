"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset, type ForgotPasswordState } from "./actions";

const initialState: ForgotPasswordState = {};

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState);

  return (
    <main>
      <div className="form-shell">
        <div className="form-panel">
          <h2>Reset Your Password</h2>

          {state.submitted ? (
            <div className="form-success show">
              <span className="check">✓</span>
              <h3>Check Your Email</h3>
              <p>
                If an account exists for that email, we&apos;ve sent a link to reset your password. It expires
                after a while, so use it soon.
              </p>
              <Link className="btn btn-ghost btn-block" href="/login">
                Back to Sign In
              </Link>
            </div>
          ) : (
            <>
              <p className="form-intro">
                Enter the email you sign in with and we&apos;ll send you a link to set a new password.
              </p>
              <form action={formAction}>
                {state.error && (
                  <p className="form-footer-note" style={{ color: "var(--red)" }}>
                    {state.error}
                  </p>
                )}
                <div className="form-grid">
                  <div className="field full">
                    <label htmlFor="email">Email</label>
                    <input id="email" name="email" type="email" autoComplete="email" required />
                  </div>
                  <div className="field full">
                    <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
                      {pending ? "Sending..." : "Send Reset Link"}
                    </button>
                  </div>
                  <p className="form-footer-note">
                    Remembered it?{" "}
                    <Link href="/login" style={{ color: "var(--green)" }}>
                      Sign in
                    </Link>
                  </p>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
