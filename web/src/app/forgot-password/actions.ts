"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type ForgotPasswordState = {
  submitted?: boolean;
  error?: string;
};

export async function requestPasswordReset(
  _prevState: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email) {
    return { error: "Enter your email address." };
  }

  // Derived from the actual request, not a hardcoded site URL -- this
  // app is reachable at both matrixsports.netlify.app and (once DNS
  // is pointed) matrixsports.net, and Supabase's Redirect URLs
  // allowlist already covers both, so whichever one the visitor is
  // actually on is what the reset link should send them back to.
  const headerList = await headers();
  const origin = headerList.get("origin") ?? `https://${headerList.get("host")}`;

  // Points straight at the reset-password page, deliberately with NO
  // query string of our own -- Supabase appends its own "?code=..."
  // to this value, and a redirectTo that already has a "?next=..." in
  // it produces a malformed two-"?" URL once that happens (only the
  // first "?" is a real query-string start; a second one downstream
  // is not). The reset-password page's Supabase client auto-detects
  // and exchanges that code on load, so no server-side /auth/callback
  // hop is needed for this flow at all.
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/reset-password`,
  });
  // (page lives at src/app/auth/reset-password/page.tsx -- keep this
  // path in sync with that if it's ever moved)

  // Always report success, whether or not that email is actually
  // registered -- telling a visitor "no account with that email"
  // would let anyone probe which addresses have accounts here.
  return { submitted: true };
}
