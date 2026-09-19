"use client";

import type { CSSProperties } from "react";
import type { IconType } from "react-icons";
import {
  FaGoogle,
  FaDiscord,
  FaGithub,
  FaLinkedinIn,
  FaFacebookF,
  FaTwitch,
} from "react-icons/fa6";
import { createClient } from "@/lib/supabase/client";

// Supabase's provider identifiers -- note linkedin_oidc, not linkedin
// (LinkedIn deprecated the old OAuth API Supabase used to target).
type Provider =
  | "google"
  | "discord"
  | "github"
  | "linkedin_oidc"
  | "facebook"
  | "twitch";

interface ProviderConfig {
  provider: Provider;
  label: string;
  Icon: IconType;
  enabled: boolean;
  style: CSSProperties;
}

// Google and Discord have real credentials in Supabase right now -- the
// rest render with their real brand colors/icons so the roadmap is
// visible, but are disabled until each one is actually configured there.
const PROVIDERS: ProviderConfig[] = [
  {
    provider: "google",
    label: "Continue with Google",
    Icon: FaGoogle,
    enabled: true,
    style: { background: "#fff", color: "#3c4043", border: "1px solid #dadce0" },
  },
  {
    provider: "discord",
    label: "Continue with Discord",
    Icon: FaDiscord,
    enabled: true,
    style: { background: "#5865F2", color: "#fff" },
  },
  {
    provider: "github",
    label: "Continue with GitHub",
    Icon: FaGithub,
    enabled: false,
    style: { background: "#24292f", color: "#fff", border: "1px solid rgba(255,255,255,0.25)" },
  },
  {
    provider: "linkedin_oidc",
    label: "Continue with LinkedIn",
    Icon: FaLinkedinIn,
    enabled: false,
    style: { background: "#0a66c2", color: "#fff" },
  },
  {
    provider: "facebook",
    label: "Continue with Facebook",
    Icon: FaFacebookF,
    enabled: false,
    style: { background: "#1877f2", color: "#fff" },
  },
  {
    provider: "twitch",
    label: "Continue with Twitch",
    Icon: FaTwitch,
    enabled: false,
    style: { background: "#9146ff", color: "#fff" },
  },
];

export default function SocialSignInButtons() {
  async function handleClick(provider: Provider) {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/home`,
      },
    });
  }

  return (
    <div className="social-buttons">
      {PROVIDERS.map(({ provider, label, Icon, enabled, style }) => (
        <button
          key={provider}
          type="button"
          className="social-btn"
          style={style}
          disabled={!enabled}
          title={enabled ? label : `${label} — coming soon`}
          aria-label={label}
          onClick={() => handleClick(provider)}
        >
          <Icon className="social-btn-icon" />
        </button>
      ))}
    </div>
  );
}
