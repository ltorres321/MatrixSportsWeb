import type { CSSProperties } from "react";
import type { IconType } from "react-icons";
import { FaInstagram, FaFacebookF, FaXTwitter, FaLinkedin } from "react-icons/fa6";

interface SocialLink {
  href: string;
  label: string;
  Icon: IconType;
  style: CSSProperties;
}

const LINKS: SocialLink[] = [
  {
    href: "https://www.instagram.com/neomatrixsports/",
    label: "Follow us on Instagram",
    Icon: FaInstagram,
    style: {
      background: "linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)",
      color: "#fff",
    },
  },
  {
    href: "https://www.facebook.com/profile.php?id=61594631364631",
    label: "Follow us on Facebook",
    Icon: FaFacebookF,
    style: { background: "#1877f2", color: "#fff" },
  },
  {
    href: "https://x.com/NeoMatrixSports",
    label: "Follow us on X",
    Icon: FaXTwitter,
    style: { background: "#000", color: "#fff" },
  },
  {
    // Personal profile, not the (currently empty) Data Insight, LLC
    // company page -- see feedback in chat history for why.
    href: "https://www.linkedin.com/in/leo-torres-a6886520/",
    label: "Follow us on LinkedIn",
    Icon: FaLinkedin,
    style: { background: "#0a66c2", color: "#fff" },
  },
];

export default function FollowUsLinks() {
  return (
    <div className="follow-us">
      <div className="follow-us-label">Follow Us</div>
      <div className="social-buttons">
        {LINKS.map(({ href, label, Icon, style }) => (
          <a
            key={href}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="social-btn"
            style={style}
            title={label}
            aria-label={label}
          >
            <Icon className="social-btn-icon" />
          </a>
        ))}
      </div>
    </div>
  );
}
