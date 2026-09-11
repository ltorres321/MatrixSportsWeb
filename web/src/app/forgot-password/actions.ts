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

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/auth/reset-password`,
  });

  // Always report success, whether or not that email is actually
  // registered -- telling a visitor "no account with that email"
  // would let anyone probe which addresses have accounts here.
  return { submitted: true };
}
