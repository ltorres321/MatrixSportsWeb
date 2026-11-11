import { NextResponse } from "next/server";
import { getCurrentAdminUserId } from "@/lib/admin";
import { getValidAccessToken, queryCreatorInfo, publishPhotoPost, TIKTOK_SITE_BASE_URL } from "@/lib/tiktok";

// Admin-triggered smoke test for the direct TikTok integration -- not
// part of the real automated pipeline (that's
// SportsContentCreation/src/lib/tiktokClient.ts, posting the actual
// generated game-prediction images). This exists so there's something
// concrete to click through for TikTok's own app-review demo video,
// and so a connection can be verified without waiting for the next
// real job to run. Posts the site's own nav logo -- WebP, well under
// every size limit -- not real prediction content.
export async function POST() {
  const adminUserId = await getCurrentAdminUserId();
  if (!adminUserId) {
    return new NextResponse("Not authorized", { status: 403 });
  }

  const token = await getValidAccessToken();
  if (!token) {
    return NextResponse.json({ error: "Not connected -- visit /api/tiktok/connect first" }, { status: 400 });
  }

  const creatorInfo = await queryCreatorInfo(token.accessToken);
  // Unaudited apps are restricted to private-only posts regardless of
  // what's requested (unaudited_client_can_only_post_to_private_accounts
  // otherwise) -- SELF_ONLY is the documented private option, and it's
  // always one of creator_info's own privacy_level_options.
  if (!creatorInfo.privacy_level_options.includes("SELF_ONLY")) {
    return NextResponse.json(
      { error: `SELF_ONLY not offered for this account: ${creatorInfo.privacy_level_options.join(", ")}` },
      { status: 500 }
    );
  }

  const { publish_id } = await publishPhotoPost(token.accessToken, {
    photoUrls: [`${TIKTOK_SITE_BASE_URL}/assets/brand/mx-logo-nav.webp`],
    description: "Test post from the Matrix Sports Analytics direct TikTok integration.",
    privacyLevel: "SELF_ONLY",
  });

  return NextResponse.json({ publishId: publish_id });
}
