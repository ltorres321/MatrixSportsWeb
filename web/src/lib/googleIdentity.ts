// Shared state between GoogleOneTap (which loads and initializes
// Google's identity script once per page) and the "Continue with
// Google" button (which asks that same initialized script to render
// Google's own button). Google's `initialize` is a page-wide singleton,
// so there has to be exactly one owner of it -- GoogleOneTap -- and
// everything else waits for its ready signal.

export const GSI_READY_EVENT = "gsi-ready";

let ready = false;
let postSignInPath = "/home";

export function isGsiReady(): boolean {
  return ready;
}

export function markGsiReady(): void {
  ready = true;
  window.dispatchEvent(new Event(GSI_READY_EVENT));
}

// Where the sign-in callback sends the user afterwards. Callers must
// pass an already-sanitized same-site path (see safeNextPath).
export function setPostSignInPath(path: string): void {
  postSignInPath = path;
}

export function getPostSignInPath(): string {
  return postSignInPath;
}
