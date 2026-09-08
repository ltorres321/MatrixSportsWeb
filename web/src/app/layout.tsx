import type { Metadata } from "next";
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
async function getAppearance(): Promise<{ theme: "dark" | "light"; rainEnabled: boolean }> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    return { theme: "dark", rainEnabled: true };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("theme, matrix_rain_enabled")
    .eq("id", userData.user.id)
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
  const { theme, rainEnabled } = await getAppearance();

  return (
    <html lang="en" data-theme={theme}>
      <body>
        {rainEnabled && <RainCanvas theme={theme} />}
        <div className="page">
          <SiteNav />
          {children}
        </div>
      </body>
    </html>
  );
}
