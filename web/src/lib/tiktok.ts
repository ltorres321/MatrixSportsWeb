import "server-only";
import { query } from "@/lib/db";

// Direct TikTok Content Posting API integration -- see
// sql/017_tiktok_direct_post_schema.sql for why this exists (SocialClaw's
// hosted asset URLs are failing TikTok's own pull step) and the table
// shapes. This file is the one place both the OAuth connect/callback
// routes here and SportsContentCreation's src/lib/tiktokClient.ts
// agree on for the token row's shape -- SportsContentCreation has its
// own copy of these same two functions (separate repo, same
// DATABASE_URL) since there's no shared package between the two.
//
// Always matrixsports.net, never SITE_BASE_URL (SportsContentCreation
// points that at the ltorres-1 test branch deploy for its other
// content-job calls) -- TikTok's PULL_FROM_URL and the OAuth
// redirect_uri both have to hit the domain actually verified in the
// TikTok developer portal, and posts must only ever come from
// production per the user's explicit instruction when the pixel went
// in (ltorres-1 traffic isn't real).
export const TIKTOK_SITE_BASE_URL = "https://matrixsports.net";
export const TIKTOK_REDIRECT_URI = `${TIKTOK_SITE_BASE_URL}/api/tiktok/callback`;
export const TIKTOK_SCOPES = "user.info.basic,video.publish";

export interface TikTokTokenRow {
  open_id: string;
  access_token: string;
  access_expires_at: string;
  refresh_token: string;
  refresh_expires_at: string;
  scope: string;
}

// Single connected account for now (one organization, one TikTok
// profile) -- grabs whichever row is most recently updated rather
// than requiring callers to know the open_id up front.
export async function getTikTokToken(): Promise<TikTokTokenRow | null> {
  const rows = await query<TikTokTokenRow>(
    "SELECT open_id, access_token, access_expires_at, refresh_token, refresh_expires_at, scope FROM tiktok_oauth_tokens ORDER BY updated_at DESC LIMIT 1"
  );
  return rows[0] ?? null;
}

export async function saveTikTokToken(token: {
  openId: string;
  accessToken: string;
  expiresInSec: number;
  refreshToken: string;
  refreshExpiresInSec: number;
  scope: string;
}): Promise<void> {
  await query(
    `INSERT INTO tiktok_oauth_tokens (open_id, access_token, access_expires_at, refresh_token, refresh_expires_at, scope, updated_at)
     VALUES ($1, $2, now() + ($3 || ' seconds')::interval, $4, now() + ($5 || ' seconds')::interval, $6, now())
     ON CONFLICT (open_id) DO UPDATE SET
       access_token = EXCLUDED.access_token,
       access_expires_at = EXCLUDED.access_expires_at,
       refresh_token = EXCLUDED.refresh_token,
       refresh_expires_at = EXCLUDED.refresh_expires_at,
       scope = EXCLUDED.scope,
       updated_at = now()`,
    [
      token.openId,
      token.accessToken,
      token.expiresInSec,
      token.refreshToken,
      token.refreshExpiresInSec,
      token.scope,
    ]
  );
}

const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;

interface TikTokRefreshResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  refresh_expires_in: number;
  open_id: string;
  scope: string;
}

// Refresh tokens rotate on every use (TikTok's own requirement -- the
// previous one stops working the instant a new one is issued), so
// this always re-saves the full row, not just the access token.
async function refreshTikTokToken(row: TikTokTokenRow): Promise<TikTokTokenRow> {
  if (!CLIENT_KEY || !CLIENT_SECRET) {
    throw new Error("TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET not configured");
  }

  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: CLIENT_KEY,
      client_secret: CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: row.refresh_token,
    }),
  });
  if (!res.ok) {
    throw new Error(`TikTok token refresh failed: ${res.status} ${await res.text()}`);
  }

  const refreshed = (await res.json()) as TikTokRefreshResponse;
  await saveTikTokToken({
    openId: refreshed.open_id,
    accessToken: refreshed.access_token,
    expiresInSec: refreshed.expires_in,
    refreshToken: refreshed.refresh_token,
    refreshExpiresInSec: refreshed.refresh_expires_in,
    scope: refreshed.scope,
  });

  return (await getTikTokToken())!;
}

// 5-minute buffer so a request in flight doesn't have its token expire
// mid-call -- access tokens are only valid 2 hours per TikTok's docs,
// comfortably longer than any single publish attempt takes.
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

export async function getValidAccessToken(): Promise<{ accessToken: string; openId: string } | null> {
  const row = await getTikTokToken();
  if (!row) return null;

  const expiresAt = new Date(row.access_expires_at).getTime();
  if (expiresAt - Date.now() > EXPIRY_BUFFER_MS) {
    return { accessToken: row.access_token, openId: row.open_id };
  }

  const refreshed = await refreshTikTokToken(row);
  return { accessToken: refreshed.access_token, openId: refreshed.open_id };
}

interface TikTokApiError {
  code: string;
  message: string;
}

async function tiktokApi<T>(path: string, accessToken: string, body: unknown): Promise<T> {
  const res = await fetch(`https://open.tiktokapis.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { data: T; error: TikTokApiError };
  if (!res.ok || json.error?.code !== "ok") {
    throw new Error(`TikTok API ${path} failed: ${json.error?.code} ${json.error?.message}`);
  }
  return json.data;
}

export interface CreatorInfo {
  creator_username: string;
  privacy_level_options: string[];
  comment_disabled: boolean;
}

export function queryCreatorInfo(accessToken: string): Promise<CreatorInfo> {
  return tiktokApi("/v2/post/publish/creator_info/query/", accessToken, {});
}

// Photo posts only support PULL_FROM_URL (no FILE_UPLOAD for photos)
// and -- until this app clears TikTok's audit -- privacy_level is
// forced to SELF_ONLY (unaudited_client_can_only_post_to_private_accounts
// otherwise). Caller is responsible for picking a privacy_level that's
// actually in creator_info's privacy_level_options.
export function publishPhotoPost(
  accessToken: string,
  opts: { photoUrls: string[]; description: string; privacyLevel: string }
): Promise<{ publish_id: string }> {
  return tiktokApi("/v2/post/publish/content/init/", accessToken, {
    media_type: "PHOTO",
    post_mode: "DIRECT_POST",
    post_info: {
      description: opts.description,
      privacy_level: opts.privacyLevel,
      disable_comment: false,
    },
    source_info: {
      source: "PULL_FROM_URL",
      photo_images: opts.photoUrls,
      photo_cover_index: 0,
    },
  });
}

export interface PublishStatus {
  status: "PROCESSING_UPLOAD" | "PROCESSING_DOWNLOAD" | "SEND_TO_USER_INBOX" | "PUBLISH_COMPLETE" | "FAILED";
  fail_reason: string;
}

export function getPublishStatus(accessToken: string, publishId: string): Promise<PublishStatus> {
  return tiktokApi("/v2/post/publish/status/fetch/", accessToken, { publish_id: publishId });
}
