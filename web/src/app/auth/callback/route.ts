import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Both flows land here: (1) clicking the "confirm your email" link
// from Supabase after signup, and (2) returning from an OAuth
// provider (Google, etc.). Supabase's JS client uses PKCE, so both
// send a `code` param that gets exchanged for a real session here --
// this is a Server Component request, and only a Route Handler can
// set cookies.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/home";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
