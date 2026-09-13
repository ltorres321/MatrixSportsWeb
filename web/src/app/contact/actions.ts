"use server";

import { Resend } from "resend";

export type ContactState = {
  submitted?: boolean;
  error?: string;
};

// Server-only -- never sent to the browser, unlike a mailto: link,
// which is the whole point of routing contact through a form instead.
const CONTACT_INBOX = "neo@matrixsports.net";

export async function sendContactMessage(
  _prevState: ContactState,
  formData: FormData
): Promise<ContactState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  // TEMPORARY diagnostic -- tracking down whether autofilled field
  // values are actually reaching the server action at all, or arriving
  // empty/stale despite the browser showing them filled. Remove once
  // resolved. Logs every raw field the server actually received, not
  // just the trimmed versions used below.
  console.log("Contact form: raw submission received", {
    name: JSON.stringify(formData.get("name")),
    email: JSON.stringify(formData.get("email")),
    messageLength: String(formData.get("message") ?? "").length,
    hp_field: JSON.stringify(formData.get("hp_field")),
  });

  // Honeypot: a field real visitors never see or fill (display:none,
  // not a "hidden" input -- some bots skip those specifically) but a
  // form-filling bot fills in anyway. Fail silently as if it worked,
  // rather than telling a bot its submission was rejected. Logged
  // (not silent server-side) since a false positive here means a real
  // visitor's message never reaches Resend at all with zero trace --
  // exactly what happened before this field was renamed away from
  // "company", which Chrome's autofill matched and filled despite the
  // field being positioned off-screen.
  if (String(formData.get("hp_field") ?? "").trim() !== "") {
    console.warn("Contact form: honeypot triggered, submission dropped", {
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
    });
    return { submitted: true };
  }

  if (!name || !email || !message) {
    return { error: "Fill in every field." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }
  if (message.length > 5000) {
    return { error: "Message is too long." };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Fails closed with a real error rather than silently pretending
    // to succeed -- a missing API key (e.g. not yet set in Netlify)
    // should be obvious immediately, not discovered days later when
    // nobody hears back from a contact request.
    console.error("RESEND_API_KEY not set -- contact form cannot send");
    return { error: "Something went wrong sending your message. Please try again shortly." };
  }

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    // From address doesn't need to be a real inbox, but the domain
    // does need to be verified in Resend before this can send to
    // anyone other than the account's own signup email -- see
    // .env.example's RESEND_API_KEY comment.
    from: "Matrix Sports Contact Form <contact@matrixsports.net>",
    to: CONTACT_INBOX,
    replyTo: email,
    subject: `Contact form: ${name}`,
    text: `From: ${name} <${email}>\n\n${message}`,
  });

  if (error) {
    console.error("Resend send failed:", error);
    return { error: "Something went wrong sending your message. Please try again shortly." };
  }

  // TEMPORARY diagnostic -- the Resend message id, to cross-reference
  // this exact send against what shows in the Resend dashboard.
  console.log("Contact form: Resend accepted send", { id: data?.id, email });

  return { submitted: true };
}
