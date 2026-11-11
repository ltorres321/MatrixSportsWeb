import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentAdminUserId } from "@/lib/admin";
import { TIKTOK_REDIRECT_URI, saveTikTokToken } from "@/lib/tiktok";

const STATE_COOKIE = "tiktok_oauth_state";
const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;

interface TikTokTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  refresh_expires_in: number;
  open_id: string;
  scope: string;
  token_type: string;
}

export async function GET(request: Request) {
  const adminUserId = await getCurrentAdminUserId();
  if (!adminUserId) {
    return new NextResponse("Not authorized", { status: 403 });
  }

  if (!CLIENT_KEY || !CLIENT_SECRET) {
    return new NextResponse("TikTok client credentials not configured", { status: 500 });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  if (error) {
    return new NextResponse(`TikTok authorization failed: ${error}`, { status: 400 });
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    return new NextResponse("Invalid or expired OAuth state -- start the connect flow again", { status: 400 });
  }

  // Token exchange is form-urlencoded, not JSON -- that's TikTok's own
  // requirement, unlike every other request this integration makes to
  // open.tiktokapis.com.
  const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: CLIENT_KEY,
      client_secret: CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: TIKTOK_REDIRECT_URI,
    }),
  });

  if (!tokenRes.ok) {
    return new NextResponse(`TikTok token exchange failed: ${tokenRes.status} ${await tokenRes.text()}`, {
      status: 502,
    });
  }

  const token = (await tokenRes.json()) as TikTokTokenResponse;

  await saveTikTokToken({
    openId: token.open_id,
    accessToken: token.access_token,
    expiresInSec: token.expires_in,
    refreshToken: token.refresh_token,
    refreshExpiresInSec: token.refresh_expires_in,
    scope: token.scope,
  });

  return NextResponse.redirect(new URL("/admin/tiktok?connected=1", request.url));
}
