import { renderPickCard, size, contentType } from "./pickCardImage";

export const runtime = "nodejs";
export const alt = "Matrix Sports Analytics — matchup prediction";
export { size, contentType };

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return renderPickCard(id);
}
