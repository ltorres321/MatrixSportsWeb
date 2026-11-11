import { query } from "@/lib/db";

interface AssetRow {
  content_type: string;
  image_bytes: Buffer;
}

// Deliberately unauthenticated -- this is the URL TikTok's own
// servers fetch for a PULL_FROM_URL photo post (see
// api/tiktok/assets/route.ts), and they do so anonymously. No
// redirects (TikTok's docs call a 3xx response here invalid), so this
// returns the bytes directly rather than, say, redirecting to a
// signed storage URL.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const rows = await query<AssetRow>(
    "SELECT content_type, image_bytes FROM tiktok_post_assets WHERE id = $1",
    [id]
  );
  const row = rows[0];
  if (!row) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(new Uint8Array(row.image_bytes), {
    headers: {
      "content-type": row.content_type,
      "cache-control": "public, max-age=3600",
    },
  });
}
