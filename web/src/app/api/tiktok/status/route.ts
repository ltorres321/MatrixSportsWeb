import { NextResponse } from "next/server";
import { getCurrentAdminUserId } from "@/lib/admin";
import { getValidAccessToken, getPublishStatus } from "@/lib/tiktok";

export async function GET(request: Request) {
  const adminUserId = await getCurrentAdminUserId();
  if (!adminUserId) {
    return new NextResponse("Not authorized", { status: 403 });
  }

  const publishId = new URL(request.url).searchParams.get("publishId");
  if (!publishId) {
    return NextResponse.json({ error: "publishId is required" }, { status: 400 });
  }

  const token = await getValidAccessToken();
  if (!token) {
    return NextResponse.json({ error: "Not connected" }, { status: 400 });
  }

  const status = await getPublishStatus(token.accessToken, publishId);
  return NextResponse.json(status);
}
