import "server-only";

// Same Resend setup as netlify/functions/_shared/digestCore.ts's
// sendEmail -- duplicated rather than shared since that file lives in
// the separately-bundled Netlify Functions context (see its own
// comment on why it can't import from here either). This one is for
// server-only use inside the Next app itself (e.g. the content-jobs
// notify route), where "server-only" has its normal meaning.
const RESEND_FROM = "Matrix Sports Analytics <neo@matrixsports.net>";

export async function sendNotifyEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY not set");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: RESEND_FROM, to: [to], subject, html }),
  });

  if (!response.ok) {
    throw new Error(`Resend API error ${response.status}: ${await response.text()}`);
  }
}
