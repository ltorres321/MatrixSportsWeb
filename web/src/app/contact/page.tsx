"use client";

import { useActionState } from "react";
import Link from "next/link";
import { sendContactMessage, type ContactState } from "./actions";

const initialState: ContactState = {};

export default function ContactPage() {
  const [state, formAction, pending] = useActionState(sendContactMessage, initialState);

  return (
    <main>
      <div className="form-shell">
        <div className="form-panel">
          <h2>Contact Us</h2>

          {state.submitted ? (
            <div className="form-success show">
              <span className="check">✓</span>
              <h3>Message Sent</h3>
              <p>Thanks for reaching out — we&apos;ll get back to you soon.</p>
              <Link className="btn btn-ghost btn-block" href="/">
                Back to Home
              </Link>
            </div>
          ) : (
            <>
              <p className="form-intro">
                Questions, feedback, or anything else — send us a message and
                we&apos;ll get back to you.
              </p>
              <form action={formAction}>
                {state.error && (
                  <p className="form-footer-note" style={{ color: "var(--red)" }}>
                    {state.error}
                  </p>
                )}
                <div className="form-grid">
                  {/* Honeypot -- genuinely hidden via display:none (an
                      off-screen-positioned field is NOT enough: Chrome's
                      autofill still recognizes a name/label like
                      "company" and fills it from a saved profile
                      regardless of position, which silently ate real
                      visitor submissions before this fix -- a nonsense
                      field name with no visible label avoids that
                      autofill heuristic matching entirely). */}
                  <input
                    type="text"
                    name="hp_field"
                    tabIndex={-1}
                    autoComplete="off"
                    style={{ display: "none" }}
                    aria-hidden="true"
                  />

                  <div className="field full">
                    <label htmlFor="name">Name</label>
                    <input id="name" name="name" type="text" autoComplete="name" required />
                  </div>
                  <div className="field full">
                    <label htmlFor="email">Email</label>
                    <input id="email" name="email" type="email" autoComplete="email" required />
                  </div>
                  <div className="field full">
                    <label htmlFor="message">Message</label>
                    <textarea id="message" name="message" required />
                  </div>
                  <div className="field full">
                    <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
                      {pending ? "Sending..." : "Send Message"}
                    </button>
                  </div>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
