import { NextResponse } from "next/server";
import { isAuthorizedContentJob } from "@/lib/contentJobAuth";
import { sendNotifyEmail } from "@/lib/notifyEmail";

const NOTIFY_TO = "neo@matrixsports.net";

interface NotifyBody {
  kind: "premier_game" | "weekly_record";
  folderPath: string;
  summary: string;
}

// Machine-to-machine endpoint for the standalone content-generation
// jobs in /home/neo/SportsContentCreation -- see contentJobAuth.ts.
// Called ONLY when a job actually wrote new content, never on a
// no-op "unchanged" run -- the caller decides that, this route just
// sends whatever it's told.
export async function POST(request: Request) {
  if (!isAuthorizedContentJob(request)) {
    return new NextResponse("Not authorized", { status: 403 });
  }

  const body = (await request.json()) as NotifyBody;
  const label = body.kind === "premier_game" ? "Premier game" : "Weekly record";

  const html = `
    <div style="font-family: 'Courier New', Courier, monospace; padding: 24px; background: #04140a; color: #eafff2;">
      <h2 style="color: #00ff41; margin: 0 0 12px;">New ${label} post ready</h2>
      <p style="margin: 0 0 8px;">${body.summary}</p>
      <p style="margin: 0 0 8px; color: #6fae83;">Folder: <code>${body.folderPath}</code></p>
      <p style="margin: 16px 0 0; color: #6fae83; font-size: 13px;">
        image.png, image_ig.png, and captions.json are ready to post manually.
      </p>
    </div>`;

  await sendNotifyEmail(NOTIFY_TO, `New ${label} post ready — ${body.folderPath}`, html);

  return NextResponse.json({ sent: true });
}
