"use server";

import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SignupState = {
  formError?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
};

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function signup(
  _prevState: SignupState,
  formData: FormData
): Promise<SignupState> {
  const firstName = str(formData, "firstName");
  const middleName = str(formData, "middleName") || null;
  const lastName = str(formData, "lastName");
  const email = str(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const fieldErrors: Record<string, string> = {};
  if (!firstName) fieldErrors.firstName = "Required";
  if (!lastName) fieldErrors.lastName = "Required";
  if (!email || !EMAIL_RE.test(email)) fieldErrors.email = "Enter a valid email";
  if (password.length < 8) fieldErrors.password = "At least 8 characters";
  if (password !== confirmPassword) fieldErrors.confirmPassword = "Passwords don't match";

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  const origin = (await headers()).get("origin");
  const supabase = await createClient();

  // Everything besides email/password rides along as user_metadata --
  // the on_auth_user_created trigger (sql/004) reads it from there to
  // build the profiles row immediately, since with email confirmation
  // required there's no session yet to attach an RLS-scoped insert to.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/home`,
      data: {
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
      },
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already registered")) {
      return { fieldErrors: { email: "An account with that email already exists. Try logging in instead." } };
    }
    return { formError: error.message };
  }

  // Supabase doesn't return an error for a duplicate email (that would
  // leak which emails are registered) -- it returns a fake "success"
  // with an empty identities array and sends nothing. Without this
  // check, the form would show "check your email" even though nothing
  // was sent -- exactly what happened when testing with an email that
  // already had an account from Google sign-in.
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    return { fieldErrors: { email: "An account with that email already exists. Try logging in instead." } };
  }

  return { success: true };
}
