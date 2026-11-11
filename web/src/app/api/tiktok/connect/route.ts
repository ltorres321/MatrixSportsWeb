import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { getCurrentAdminUserId } from "@/lib/admin";
import { TIKTOK_REDIRECT_URI, TIKTOK_SCOPES } from "@/lib/tiktok";

const STATE_COOKIE = "tiktok_oauth_state";
const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;

// Admin-only, interactive (browser redirect) -- the one-time Login
// Kit consent dance for the single connected TikTok account. Distinct
// from contentJobAuth.ts's bearer-secret check further down this same
// feature (the unattended publish calls), since this one's driven by
// an actual logged-in admin clicking a button, not a cron job.
export async function GET() {
  const adminUserId = await getCurrentAdminUserId();
  if (!adminUserId) {
    return new NextResponse("Not authorized", { status: 403 });
  }

  if (!CLIENT_KEY) {
    return new NextResponse("TIKTOK_CLIENT_KEY not configured", { status: 500 });
  }

  const state = randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes -- only needs to survive the TikTok consent redirect round trip
  });

  const authorizeUrl = new URL("https://www.tiktok.com/v2/auth/authorize/");
  authorizeUrl.searchParams.set("client_key", CLIENT_KEY);
  authorizeUrl.searchParams.set("scope", TIKTOK_SCOPES);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("redirect_uri", TIKTOK_REDIRECT_URI);
  authorizeUrl.searchParams.set("state", state);

  return NextResponse.redirect(authorizeUrl.toString());
}
