// Shared identifiers for JSON-LD structured data. Every script tag
// across the site that declares the "Matrix Sports Analytics"
// Organization reuses this exact @id instead of restating the
// Organization inline -- a repeated name with no @id is what the
// scan's "Entity Identity" check flags, since nothing then ties those
// declarations together as the same entity across pages.
export const SITE_URL = "https://matrixsports.net";
export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;
export const ORGANIZATION_NAME = "Matrix Sports Analytics";

export const SOCIAL_LINKS = [
  "https://www.instagram.com/neomatrixsports/",
  "https://www.facebook.com/profile.php?id=61594631364631",
  "https://x.com/NeoMatrixSports",
  "https://www.linkedin.com/in/leo-torres-a6886520/",
];

export const organizationJsonLd = {
  "@type": "Organization",
  "@id": ORGANIZATION_ID,
  name: ORGANIZATION_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/assets/brand/mx-logo.png`,
  sameAs: SOCIAL_LINKS,
};

export const websiteJsonLd = {
  "@type": "WebSite",
  "@id": WEBSITE_ID,
  url: SITE_URL,
  name: ORGANIZATION_NAME,
  publisher: { "@id": ORGANIZATION_ID },
};

// Rendered once in the root layout as a single <script> tag: one
// @context wrapping both declarations via @graph, rather than two
// separate script tags each repeating @context.
export const siteJsonLdGraph = {
  "@context": "https://schema.org",
  "@graph": [organizationJsonLd, websiteJsonLd],
};

// Reference-only pointer at the already-declared Organization above,
// for use as the `author`/`publisher` of an Article -- avoids
// restating name, url, logo and sameAs on every single game/story page.
export const organizationRef = { "@id": ORGANIZATION_ID };

// Next's Metadata API does NOT sync a page's title/description into
// its openGraph/twitter blocks automatically -- a page that sets only
// `title`/`description` silently keeps the root layout's generic
// openGraph/twitter values (which is why og:title/og:description were
// stuck on "Matrix Sports Analytics" for every shared game/story link).
// Every page's metadata should be built through this helper so the
// three copies (head title, OG, Twitter) can't drift apart again.
export function pageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description?: string;
  path: string;
}) {
  const url = `${SITE_URL}${path}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url },
    twitter: { card: "summary_large_image" as const, title, description },
  };
}
