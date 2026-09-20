"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signup, type SignupState } from "./actions";
import { TEAMS } from "@/lib/teams";
import SocialSignInButtons from "@/components/SocialSignInButtons";

const initialState: SignupState = {};

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signup, initialState);

  const errors = state.fieldErrors ?? {};

  if (state.success) {
    return (
      <main>
        <div className="form-shell">
          <div className="form-panel">
            <div className="form-success show">
              <span className="check">✓</span>
              <h3>Check Your Email</h3>
              <p>
                We sent a confirmation link to finish creating your account.
                Click it, and you&apos;ll land on your predictions dashboard,
                signed in.
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="form-shell">
        <div className="form-panel">
          <h2>Create Your Free Account</h2>
          <p className="form-intro">
            Free during beta. Early subscribers lock in preferential
            pricing when paid tiers launch — no credit card required now.
          </p>

          <SocialSignInButtons />
          <div className="or-divider">OR SIGN UP WITH EMAIL</div>

          <form action={formAction}>
            {state.formError && (
              <p className="form-footer-note" style={{ color: "var(--red)" }}>
                {state.formError}
              </p>
            )}

            <div className="form-grid">
              <div className="field">
                <label htmlFor="firstName">First Name</label>
                <input id="firstName" name="firstName" autoComplete="given-name" className={errors.firstName ? "invalid" : ""} />
                <div className="error-msg">{errors.firstName}</div>
              </div>

              <div className="field">
                <label htmlFor="middleName">
                  Middle Name <span className="optional-tag">(optional)</span>
                </label>
                <input id="middleName" name="middleName" autoComplete="additional-name" />
              </div>

              <div className="field full">
                <label htmlFor="lastName">Last Name</label>
                <input id="lastName" name="lastName" autoComplete="family-name" className={errors.lastName ? "invalid" : ""} />
                <div className="error-msg">{errors.lastName}</div>
              </div>

              <div className="field full">
                <label htmlFor="email">Email</label>
                <input id="email" name="email" type="email" autoComplete="email" className={errors.email ? "invalid" : ""} />
                <div className="error-msg">{errors.email}</div>
              </div>

              <div className="field">
                <label htmlFor="password">Password</label>
                <input id="password" name="password" type="password" autoComplete="new-password" className={errors.password ? "invalid" : ""} />
                <div className="error-msg">{errors.password}</div>
              </div>

              <div className="field">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" className={errors.confirmPassword ? "invalid" : ""} />
                <div className="error-msg">{errors.confirmPassword}</div>
              </div>

              <div className="field full">
                <label htmlFor="favoriteTeam">
                  Favorite Team <span className="optional-tag">(optional)</span>
                </label>
                <select id="favoriteTeam" name="favoriteTeam" defaultValue="">
                  <option value="">No preference</option>
                  {TEAMS.map((team) => (
                    <option key={team.alias} value={team.alias}>
                      {team.market} {team.name}
                    </option>
                  ))}
                </select>
              </div>

              <p className="form-footer-note">
                By signing up you agree to receive account-related email and
                to our <Link href="/terms">Terms of Service</Link> and{" "}
                <Link href="/privacy">Privacy Policy</Link>.
              </p>

              <div className="field full">
                <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
                  {pending ? "Creating Account..." : "Create Free Account"}
                </button>
              </div>

              <p className="form-footer-note">
                Already have an account?{" "}
                <Link href="/login" style={{ color: "var(--green)" }}>
                  Log in
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
