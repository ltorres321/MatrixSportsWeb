import { renderPickCard, size, contentType } from "./pickCardImage";

export const runtime = "nodejs";
export const alt = "Matrix Sports Analytics — matchup prediction";
export { size, contentType };

// See opengraph-image.tsx's identical export for the full reasoning --
// same route cost, same fix.
export const revalidate = 600;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return renderPickCard(id);
}
