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
                  {/* Honeypot -- visually hidden (not type="hidden",
                      which some bots skip specifically), real visitors
                      never see or fill this in. */}
                  <div className="field full" style={{ position: "absolute", left: "-9999px" }} aria-hidden="true">
                    <label htmlFor="company">Company</label>
                    <input id="company" name="company" type="text" tabIndex={-1} autoComplete="off" />
                  </div>

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
