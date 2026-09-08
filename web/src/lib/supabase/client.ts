import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client -- use this from Client Components
// ("use client"). For Server Components/Actions use ./server instead.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
