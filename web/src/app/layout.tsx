import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import RainCanvas from "@/components/RainCanvas";
import SiteNav from "@/components/SiteNav";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Matrix Sports Analytics",
  description: "AI-simulated NFL win probabilities.",
};

// Appearance (theme, rain effect) is a per-account preference set on
// the Profile page. Read server-side here so the right theme is in
// the very first HTML sent -- doing this client-side instead would
// flash the default look before switching, since it'd have to wait
// for a browser round trip to Supabase first.
async function getAppearance(
  userId: string | undefined
): Promise<{ theme: "dark" | "light"; rainEnabled: boolean }> {
  if (!userId) {
    return { theme: "dark", rainEnabled: true };
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("theme, matrix_rain_enabled")
    .eq("id", userId)
    .single();

  const theme = profile?.theme === "light" ? "light" : "dark";

  return {
    theme,
    // Rain is a dark-theme-only effect -- light theme forces it off
    // regardless of what's stored, as a safety net alongside the
    // enforcement in profile/page.tsx's save handler.
    rainEnabled: theme === "light" ? false : (profile?.matrix_rain_enabled ?? true),
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Read here (server-side, every request) rather than in SiteNav via
  // a client hook -- SiteNav lives in this persistent layout, which
  // never remounts on an in-app navigation, so a one-time client-side
  // getUser() call would keep showing "Sign In / Login" forever after
  // a Server Action login redirects here, until an actual full page
  // reload. Resolving it server-side on every request means the nav
  // is correct the instant the redirect lands, no reload needed.
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const { theme, rainEnabled } = await getAppearance(userData.user?.id);

  return (
    <html lang="en" data-theme={theme}>
      <body>
        {rainEnabled && <RainCanvas theme={theme} />}
        <div className="page">
          <SiteNav signedIn={!!userData.user} />
          {children}
          <div className="legal-footer">
            <Link href="/privacy">Privacy Policy</Link>
          </div>
        </div>
      </body>
    </html>
  );
}
