import { readFile } from "fs/promises";
import path from "path";

// Same approach as game/[id]/pickCardImage.tsx's logoDataUri: the
// image renderer (Satori, via next/og) needs a data URI or absolute
// URL, not a relative /assets/... path, so team logos are read
// straight off disk as base64 rather than fetched over HTTP.
export async function logoDataUri(alias: string): Promise<string> {
  const filePath = path.join(process.cwd(), "public", "assets", "team-logos", `${alias}.png`);
  const buf = await readFile(filePath);
  return `data:image/png;base64,${buf.toString("base64")}`;
}
