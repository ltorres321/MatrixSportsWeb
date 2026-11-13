"use client";

import Script from "next/script";
import { useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { getPostSignInPath, markGsiReady } from "@/lib/googleIdentity";

// Google's identity script attaches this global -- not worth pulling
// in @types/google.accounts for one callback shape.
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          prompt: () => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Supabase's signInWithIdToken re-hashes `nonce` and checks it against
// the hash baked into the ID token Google returns, so the plaintext
// never travels anywhere but this browser and Supabase -- the hashed
// version is the only one Google ever sees (in `initialize` below).
async function generateNonce(): Promise<[nonce: string, hashedNonce: string]> {
  const nonce = toHex(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(nonce));
  return [nonce, toHex(new Uint8Array(digest))];
}

// Renders nothing itself -- Google's script draws its own floating
// "Continue as ..." prompt once initialized. Only mount this for
// signed-out visitors (see layout.tsx): initializing it for someone
// already signed in would prompt them again for no reason.
//
// Needs NEXT_PUBLIC_GOOGLE_CLIENT_ID set to the *same* OAuth client ID
// already configured for the Google provider in Supabase's dashboard
// (Authentication > Providers > Google), so the ID token's audience
// matches what Supabase expects. That client's Google Cloud Console
// entry also needs this site's exact deployed origin listed under
// Authorized JavaScript origins -- One Tap's FedCM flow won't prompt
// on an origin Google hasn't been told about, which is why this needs
// testing on a real deployed URL rather than localhost.
export default function GoogleOneTap() {
  const initialized = useRef(false);

  const handleScriptLoad = useCallback(async () => {
    if (initialized.current || !CLIENT_ID || !window.google) return;
    initialized.current = true;

    const [nonce, hashedNonce] = await generateNonce();
    const supabase = createClient();

    window.google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: async (response: { credential: string }) => {
        const { error } = await supabase.auth.signInWithIdToken({
          provider: "google",
          token: response.credential,
          nonce,
        });
        // A full navigation, not router.push: the signed-in/out state
        // in layout.tsx is read server-side once per request, and a
        // client-side route change doesn't make Next.js re-run that --
        // same reasoning as the Server Action login flow (see
        // layout.tsx's getAppearance comment).
        if (!error) window.location.assign(getPostSignInPath());
      },
      nonce: hashedNonce,
      // Chrome is retiring the old third-party-cookie-based prompt in
      // favor of FedCM -- this is the same flow behind the
      // no-click "Continue as ..." prompt other sites show.
      use_fedcm_for_prompt: true,
    });
    // Lets the login/signup "Continue with Google" button render
    // Google's own button against this same initialized client (see
    // SocialSignInButtons) instead of redirecting through Supabase.
    markGsiReady();
    window.google.accounts.id.prompt();
  }, []);

  if (!CLIENT_ID) return null;

  return (
    <Script
      src="https://accounts.google.com/gsi/client"
      strategy="afterInteractive"
      onLoad={handleScriptLoad}
    />
  );
}
