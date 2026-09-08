"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login, type LoginState } from "./actions";
import SocialSignInButtons from "@/components/SocialSignInButtons";

const initialState: LoginState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <main>
      <div className="form-shell">
        <div className="form-panel">
          <h2>Sign In</h2>
          <p className="form-intro">Welcome back — pick up right where you left off.</p>

          <SocialSignInButtons />
          <div className="or-divider">OR SIGN IN WITH EMAIL</div>

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
                <label htmlFor="password">Password</label>
                <input id="password" name="password" type="password" autoComplete="current-password" required />
              </div>

              <div className="field full">
                <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
                  {pending ? "Signing In..." : "Sign In"}
                </button>
              </div>

              <p className="form-footer-note">
                Don&apos;t have an account?{" "}
                <Link href="/signup" style={{ color: "var(--green)" }}>
                  Sign up free
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
