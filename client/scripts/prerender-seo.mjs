/** Build complete static HTML and SEO assets for the reviewed public library. */
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { publicTopicBySlug, publicTopics, validatePublicTopics } from "../src/data/publicTopics.js";

const DIST = join(import.meta.dirname, "..", "dist");
const SITE_URL = "https://www.learn-anything.ca";
const SITE_NAME = "LearnAnything";
const DEFAULT_DESC = "Generate structured learning paths for any topic with AI. Beginner to advanced concepts, organized and ready to learn.";
const template = readFileSync(join(DIST, "index.html"), "utf-8");

validatePublicTopics();
if (publicTopics.length !== 24) throw new Error(`Expected 24 published topics, found ${publicTopics.length}.`);

function esc(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function list(items) { return `<ul>${items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`; }
function breadcrumbs(items) { return `<nav aria-label="Breadcrumb">${items.map((item, index) => item.href ? `<a href="${item.href}">${esc(item.name)}</a>${index < items.length - 1 ? " / " : ""}` : esc(item.name)).join("")}</nav>`; }

const homeJsonLd = { "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, url: SITE_URL, potentialAction: { "@type": "SearchAction", target: `${SITE_URL}/learningpath?term={search_term_string}`, "query-input": "required name=search_term_string" } };

const routes = [
  { path: "/", title: SITE_NAME, description: DEFAULT_DESC, jsonLd: homeJsonLd, body: `<main><h1>LearnAnything</h1><p>${esc(DEFAULT_DESC)}</p><p><a href="/topics">Browse 24 reviewed learning paths</a> or generate a private path for any other topic.</p><h2>Featured paths</h2><ul>${["javascript", "negotiation", "creative-writing", "cooking", "meditation"].map((slug) => `<li><a href="/learn/${slug}">${esc(publicTopicBySlug.get(slug).topic)}</a></li>`).join("")}</ul></main>` },
  { path: "/about", title: `About | ${SITE_NAME}`, description: "Learn how LearnAnything turns complex topics into structured beginner-to-advanced roadmaps.", jsonLd: { "@context": "https://schema.org", "@type": "AboutPage", name: `About ${SITE_NAME}`, url: `${SITE_URL}/about` }, body: `<main>${breadcrumbs([{ name: "Home", href: "/" }, { name: "About" }])}<h1>About LearnAnything</h1><p>LearnAnything helps independent learners turn a broad goal into a sequence they can act on. The reviewed public library is edited for clarity, while arbitrary AI-generated paths remain private to the learner and excluded from search indexing.</p></main>` },
  { path: "/topics", title: `Learning Path Topics | ${SITE_NAME}`, description: "Browse 24 reviewed learning paths across technology, career, creative, and everyday skills.", jsonLd: { "@context": "https://schema.org", "@type": "CollectionPage", name: "Learning Path Topics", url: `${SITE_URL}/topics` }, body: topicsBody() },
  { path: "/feedback", title: `Feedback | ${SITE_NAME}`, description: "Send feedback about LearnAnything.", robots: "noindex,follow", body: `<main><h1>Feedback</h1><p>This utility page lets visitors send product feedback.</p></main>` },
  { path: "/learningpath", title: `Generated Learning Path | ${SITE_NAME}`, description: "A private AI-generated learning path.", robots: "noindex,follow", body: `<main><h1>Generated learning path</h1><p>This private path loads when JavaScript is enabled and is not included in search results.</p></main>` },
  { path: "/share", title: `Shared Learning Path | ${SITE_NAME}`, description: "An immutable, unlisted learning-path snapshot.", robots: "noindex,nofollow", body: `<main><h1>Shared learning path</h1><p>Anyone with the complete share link can view its immutable snapshot. Shared paths are not listed publicly.</p></main>` },
  ...publicTopics.map(publicRoute),
];

function topicsBody() {
  const categories = [...new Set(publicTopics.map((topic) => topic.category))];
  return `<main>${breadcrumbs([{ name: "Home", href: "/" }, { name: "Topics" }])}<h1>Explore reviewed learning paths</h1><p>Choose a curated roadmap with a clear sequence, practical outcomes, and trusted resources.</p>${categories.map((category) => `<section><h2>${esc(category)}</h2>${publicTopics.filter((topic) => topic.category === category).map((topic) => `<article><h3><a href="/learn/${topic.slug}">${esc(topic.topic)}</a></h3><p>${esc(topic.excerpt)}</p></article>`).join("")}</section>`).join("")}</main>`;
}

function publicRoute(topic) {
  const path = `/learn/${topic.slug}`;
  const url = `${SITE_URL}${path}`;
  const jsonLd = { "@context": "https://schema.org", "@graph": [
    { "@type": "LearningResource", name: `${topic.topic} Learning Path`, description: topic.excerpt, url, educationalLevel: ["Beginner", "Intermediate", "Advanced"], teaches: topic.outcomes },
    { "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Topics", item: `${SITE_URL}/topics` },
      { "@type": "ListItem", position: 3, name: topic.topic, item: url },
    ] },
  ] };
  const levels = ["Beginner", "Intermediate", "Advanced"].map((level) => `<section><h2>${level}</h2><ol>${topic.levels[level].map((concept) => `<li><h3>${esc(concept.name)}</h3><p>${esc(concept.summary)}</p><p><strong>Why it matters:</strong> ${esc(concept.why)}</p></li>`).join("")}</ol></section>`).join("");
  const related = topic.relatedSlugs.map((slug) => publicTopicBySlug.get(slug)).map((relatedTopic) => `<a href="/learn/${relatedTopic.slug}">${esc(relatedTopic.topic)}</a>`).join(" · ");
  const resources = `<ul>${topic.resources.map((resource) => `<li><a href="${esc(resource.url)}">${esc(resource.title)}</a></li>`).join("")}</ul>`;
  return { path, title: `${topic.topic} Learning Path | ${SITE_NAME}`, description: topic.excerpt, jsonLd, body: `<main>${breadcrumbs([{ name: "Home", href: "/" }, { name: "Topics", href: "/topics" }, { name: topic.topic }])}<p>${esc(topic.category)} · Reviewed ${topic.reviewedDate}</p><h1>${esc(topic.topic)} learning path</h1><p>${esc(topic.introduction)}</p><section><h2>Prerequisites</h2>${list(topic.prerequisites)}</section><section><h2>Learning outcomes</h2>${list(topic.outcomes)}</section>${levels}<section><h2>Authoritative resources</h2>${resources}</section><section><h2>Related learning paths</h2><p>${related}</p></section></main>` };
}

function cleanedTemplate() {
  return template
    .replace(/<title>[\s\S]*?<\/title>/gi, "")
    .replace(/\s*<meta\s+(?:name|property)="(?:description|robots|og:title|og:description|og:url|og:site_name|og:type|twitter:url|twitter:title|twitter:description)"[^>]*\/?\s*>/gi, "")
    .replace(/\s*<link\s+rel="canonical"[^>]*\/?\s*>/gi, "");
}

function headTags(route) {
  const canonical = `${SITE_URL}${route.path === "/" ? "" : route.path}`;
  const tags = [
    `<title>${esc(route.title)}</title>`, `<meta name="description" content="${esc(route.description)}">`,
    `<meta name="robots" content="${route.robots ?? "index,follow"}">`, `<link rel="canonical" href="${canonical}">`,
    `<meta property="og:title" content="${esc(route.title)}">`, `<meta property="og:description" content="${esc(route.description)}">`,
    `<meta property="og:url" content="${canonical}">`, `<meta property="og:site_name" content="${SITE_NAME}">`, `<meta property="og:type" content="website">`,
  ];
  if (route.jsonLd) tags.push(`<script type="application/ld+json">${JSON.stringify(route.jsonLd).replace(/<\//g, "<\\/")}</script>`);
  return tags.join("\n    ");
}

for (const route of routes) {
  const html = cleanedTemplate().replace("</head>", `    ${headTags(route)}\n  </head>`).replace('<div id="root"></div>', `<div id="root"><div data-prerendered="true">${route.body}</div></div>`);
  const outDir = route.path === "/" ? DIST : join(DIST, ...route.path.split("/").filter(Boolean));
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "index.html"), html, "utf-8");
  console.log(`[prerender] ${route.path}`);
}

// Vercel's dynamic share responder validates the ID before returning this noindex app shell.
writeFileSync(join(DIST, "share-shell.html"), readFileSync(join(DIST, "share", "index.html"), "utf-8"), "utf-8");

const indexableRoutes = routes.filter((route) => !route.robots?.includes("noindex"));
if (indexableRoutes.length !== 27) throw new Error(`Expected exactly 27 indexable pages, found ${indexableRoutes.length}.`);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexableRoutes.map((route) => `  <url><loc>${SITE_URL}${route.path === "/" ? "/" : route.path}</loc><lastmod>${route.path.startsWith("/learn/") ? publicTopicBySlug.get(route.path.split("/").pop()).reviewedDate : "2026-08-08"}</lastmod></url>`).join("\n")}\n</urlset>\n`;
writeFileSync(join(DIST, "sitemap.xml"), sitemap, "utf-8");
console.log(`[prerender] Done: ${routes.length} HTML routes, ${indexableRoutes.length} sitemap URLs.`);
