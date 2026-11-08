import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { MAINTENANCE_HTML } from "@/lib/maintenance-page";

export async function proxy(request: NextRequest) {
  // Emergency kill switch: when Supabase itself is unreachable, every
  // request hangs in updateSession() below waiting on
  // supabase.auth.getUser() and the whole site goes down with 500s.
  // Set MAINTENANCE_MODE=true in Netlify env vars to serve this
  // static page instead -- it never touches Supabase, so it stays up
  // no matter what state the DB/Auth service is in.
  if (process.env.MAINTENANCE_MODE === "true") {
    return new NextResponse(MAINTENANCE_HTML, {
      status: 503,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "retry-after": "60",
      },
    });
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
