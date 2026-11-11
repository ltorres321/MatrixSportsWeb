import { NextResponse } from "next/server";
import { isAuthorizedContentJob } from "@/lib/contentJobAuth";
import { query } from "@/lib/db";
import { TIKTOK_SITE_BASE_URL } from "@/lib/tiktok";

interface StageAssetBody {
  contentBase64: string;
  contentType: string;
}

interface AssetIdRow {
  id: string;
}

// Machine-to-machine, called from SportsContentCreation's
// src/lib/tiktokClient.ts right before a TikTok content/init call.
// TikTok's photo posts only support PULL_FROM_URL (no FILE_UPLOAD for
// photos -- confirmed against the current API docs), so the job's
// locally-generated image has to land at a real, verified-domain
// HTTPS URL before TikTok's servers can fetch it. See
// sql/017_tiktok_direct_post_schema.sql for the table this writes to.
export async function POST(request: Request) {
  if (!isAuthorizedContentJob(request)) {
    return new NextResponse("Not authorized", { status: 403 });
  }

  const body = (await request.json()) as StageAssetBody;
  if (!body.contentBase64 || !body.contentType) {
    return NextResponse.json({ error: "contentBase64 and contentType are required" }, { status: 400 });
  }

  const buffer = Buffer.from(body.contentBase64, "base64");
  const rows = await query<AssetIdRow>(
    "INSERT INTO tiktok_post_assets (content_type, image_bytes) VALUES ($1, $2) RETURNING id",
    [body.contentType, buffer]
  );

  const id = rows[0].id;
  return NextResponse.json({ url: `${TIKTOK_SITE_BASE_URL}/api/tiktok/asset/${id}` });
}
