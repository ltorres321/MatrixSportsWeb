import sharp from "sharp";
import { renderPickCard } from "../pickCardImage";

export const runtime = "nodejs";

// Separate from opengraph-image.tsx/twitter-image.tsx on purpose --
// those two are Next's special-file conventions and their PNG output
// is what Facebook/Twitter's crawlers actually fetch for link
// previews, so their format and full 1200x630 resolution can't change
// without risking broken social cards. This route reuses the exact
// same renderPickCard() (identical visual layout, same data), then
// re-encodes the result smaller and as WebP -- only for the on-page
// <img> thumbnails on the homepage and /stories archive, which
// display this at a fraction of 1200x630 (.news-card-image is a
// fluid-width, 160px-tall, object-fit: cover box). Lighthouse flagged
// those <img> tags pulling the full social-card PNG as the single
// biggest "improve image delivery" finding (~200 KiB across 2-3 cards
// per page load). 800x420 keeps the same 1200x630 aspect ratio (so
// object-fit: cover crops identically) while covering up to ~400 CSS
// px of display width at 2x retina -- comfortably more than this grid
// ever renders a single card at -- and WebP compounds the savings on
// top of the smaller pixel count.
export const revalidate = 600;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const png = await renderPickCard(id);
  const buf = Buffer.from(await png.arrayBuffer());
  const webp = await sharp(buf).resize(800, 420).webp({ quality: 80 }).toBuffer();

  return new Response(new Uint8Array(webp), {
    headers: {
      "content-type": "image/webp",
      "cache-control": "public, max-age=600, stale-while-revalidate=86400",
    },
  });
}
