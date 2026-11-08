import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase auth session on every request so Server
// Components always see a valid (or correctly expired) session
// instead of a stale one. See src/middleware.ts for where this runs.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not remove -- this call revalidates the token and must run
  // before any other logic that depends on the session. Bounded with
  // a timeout: on 2026-11-08 Supabase's Postgres went unreachable and
  // this call hung until the edge function itself timed out, taking
  // every route on the site down with it. Failing fast here instead
  // lets the request fall through with whatever session cookies it
  // already had rather than crashing the whole function.
  try {
    await Promise.race([
      supabase.auth.getUser(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("auth.getUser timed out")), 5_000)
      ),
    ]);
  } catch (err) {
    console.error("Supabase session refresh failed, continuing without it:", err);
  }

  return supabaseResponse;
}
