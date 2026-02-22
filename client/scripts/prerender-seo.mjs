/**
 * Post-build SEO injection script.
 *
 * Reads dist/index.html, then for each configured route, generates a
 * route-specific HTML file with the correct <title>, <meta>, <link>,
 * and JSON-LD injected into <head>.  This ensures bots that don't run
 * JS still see the critical SEO signals.
 *
 * Usage:  node scripts/prerender-seo.mjs
 * (called automatically by `npm run build`)
 */

import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";

const DIST = join(import.meta.dirname, "..", "dist");
const SITE_URL = "https://www.learn-anything.ca";
const SITE_NAME = "LearnAnything";
const DEFAULT_DESC =
  "Generate structured learning paths for any topic with AI. Beginner to advanced concepts, organized and ready to learn.";

// ── Route definitions ──────────────────────────────────────────────

const routes = [
  {
    path: "/",
    title: SITE_NAME,
    description: DEFAULT_DESC,
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebSite",
          "@id": `${SITE_URL}/#website`,
          url: SITE_URL,
          name: SITE_NAME,
          description: DEFAULT_DESC,
          publisher: { "@id": `${SITE_URL}/#organization` },
          potentialAction: {
            "@type": "SearchAction",
            target: {
              "@type": "EntryPoint",
              urlTemplate: `${SITE_URL}/learningpath?term={search_term_string}`,
            },
            "query-input": "required name=search_term_string",
          },
        },
        {
          "@type": "WebApplication",
          "@id": `${SITE_URL}/#app`,
          name: SITE_NAME,
          url: SITE_URL,
          applicationCategory: "EducationalApplication",
          operatingSystem: "All",
          description:
            "AI-powered learning path generator that organizes any topic into beginner, intermediate, and advanced concepts.",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        },
        {
          "@type": "Organization",
          "@id": `${SITE_URL}/#organization`,
          name: SITE_NAME,
          url: SITE_URL,
          sameAs: ["https://github.com/yixin0829/lp-generator"],
        },
      ],
    },
  },
  {
    path: "/about",
    title: `About | ${SITE_NAME}`,
    description:
      "Meet the developers behind LearnAnything — an AI-powered learning path generator that helps you learn any topic from beginner to advanced.",
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "AboutPage",
          "@id": `${SITE_URL}/about`,
          url: `${SITE_URL}/about`,
          name: `About ${SITE_NAME}`,
          isPartOf: { "@id": `${SITE_URL}/#website` },
        },
        {
          "@type": "Organization",
          "@id": `${SITE_URL}/#organization`,
          name: SITE_NAME,
          url: SITE_URL,
          sameAs: ["https://github.com/yixin0829/lp-generator"],
        },
        {
          "@type": "Person",
          "@id": `${SITE_URL}/#person-yixin`,
          name: "Yixin Tian",
          url: "https://www.yixtian.com",
          sameAs: [
            "https://github.com/yixin0829",
            "https://www.linkedin.com/in/yixintian/",
          ],
        },
        {
          "@type": "Person",
          "@id": `${SITE_URL}/#person-james`,
          name: "James Kokoska",
          sameAs: ["https://github.com/jameskokoska"],
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
            {
              "@type": "ListItem",
              position: 2,
              name: "About",
              item: `${SITE_URL}/about`,
            },
          ],
        },
      ],
    },
  },
];

// ── Injection logic ────────────────────────────────────────────────

function buildHeadTags({ title, description, path, jsonLd, robots }) {
  const canonical = `${SITE_URL}${path === "/" ? "" : path}`;
  const robotsMeta = robots ?? "index,follow";
  const lines = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}">`,
    `<meta name="robots" content="${robotsMeta}">`,
    `<link rel="canonical" href="${esc(canonical)}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    `<meta property="og:url" content="${esc(canonical)}">`,
    `<meta property="og:site_name" content="${esc(SITE_NAME)}">`,
    `<meta property="og:type" content="website">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(description)}">`,
  ];
  if (jsonLd) {
    lines.push(
      `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`,
    );
  }
  return lines.join("\n    ");
}

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Main ───────────────────────────────────────────────────────────

const template = readFileSync(join(DIST, "index.html"), "utf-8");

for (const route of routes) {
  const tags = buildHeadTags(route);
  const html = template.replace("</head>", `    ${tags}\n  </head>`);

  const outDir =
    route.path === "/"
      ? DIST
      : join(DIST, ...route.path.split("/").filter(Boolean));
  mkdirSync(outDir, { recursive: true });

  const outFile = route.path === "/" ? join(DIST, "index.html") : join(outDir, "index.html");
  writeFileSync(outFile, html, "utf-8");
  console.log(`[prerender-seo] ${route.path} → ${outFile}`);
}

console.log(`[prerender-seo] Done — ${routes.length} routes injected.`);
