import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server-side Supabase client -- use this from Server Components,
// Server Actions, and Route Handlers. Cookies are how the user's
// session travels with the request; writes here can be ignored when
// called from a Server Component (it can't set cookies), which is
// fine because middleware.ts refreshes the session on every request.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component -- ignore, middleware.ts
            // handles refreshing the session instead.
          }
        },
      },
    }
  );
}
