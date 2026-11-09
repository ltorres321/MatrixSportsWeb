// Only ever redirect to a path on this same site. Login/signup/OAuth
// all thread a user-controlled ?next= (or form field) through to a
// final redirect -- accepting that unsanitized is a textbook open
// redirect (e.g. next=https://evil.example or next=//evil.example
// bouncing a victim through our own trusted domain to theirs).
export function safeNextPath(raw: string | null | undefined, fallback = "/home"): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("://")) return fallback;
  return raw;
}
