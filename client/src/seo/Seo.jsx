/**
 * Per-route SEO component using React 19 native <head> hoisting.
 * Handles title, meta, OG, Twitter, canonical, robots, and optional JSON-LD.
 *
 * Drop <Seo .../> anywhere in a page component to set head tags.
 */

import { SITE_NAME, SITE_URL, SITE_DESCRIPTION, DEFAULT_OG_IMAGE } from "../config/site";

export default function Seo({
  title,
  description = SITE_DESCRIPTION,
  path = "/",
  ogImage = DEFAULT_OG_IMAGE,
  ogType = "website",
  robots = "index,follow",
  noindex = false,
  jsonLd,
}) {
  const canonicalUrl = `${SITE_URL}${path}`;
  const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
  const robotsContent = noindex ? "noindex,follow" : robots;

  return (
    <>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={robotsContent} />
      <link rel="canonical" href={canonicalUrl} />

      {/* OpenGraph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content={ogType} />
      <meta property="og:image" content={ogImage} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
    </>
  );
}
