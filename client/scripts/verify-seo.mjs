import { readFileSync } from "fs";
import { join } from "path";
import { publicTopics } from "../src/data/publicTopics.js";

const dist = join(import.meta.dirname, "..", "dist");
const siteUrl = "https://www.learn-anything.ca";
const sitemap = readFileSync(join(dist, "sitemap.xml"), "utf-8");
const locations = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);

function assert(condition, message) {
  if (!condition) throw new Error(`[verify-seo] ${message}`);
}

assert(locations.length === 27, `expected 27 sitemap URLs, found ${locations.length}`);
assert(new Set(locations).size === 27, "sitemap URLs must be unique");
assert(locations.includes(`${siteUrl}/`) && locations.includes(`${siteUrl}/about`) && locations.includes(`${siteUrl}/topics`), "sitemap is missing a core route");
assert(!sitemap.includes("/share/") && !sitemap.includes("/learningpath") && !sitemap.includes("/feedback"), "sitemap contains a non-indexable route");

const titles = new Set();
const descriptions = new Set();
for (const topic of publicTopics) {
  const route = `/learn/${topic.slug}`;
  const html = readFileSync(join(dist, "learn", topic.slug, "index.html"), "utf-8");
  const canonical = `${siteUrl}${route}`;
  const titleMatches = [...html.matchAll(/<title>(.*?)<\/title>/g)];
  const descMatches = [...html.matchAll(/<meta name="description" content="(.*?)">/g)];
  const canonicalMatches = [...html.matchAll(/<link rel="canonical" href="(.*?)">/g)];
  assert(titleMatches.length === 1 && !titles.has(titleMatches[0][1]), `${route} needs one unique title`);
  assert(descMatches.length === 1 && !descriptions.has(descMatches[0][1]), `${route} needs one unique description`);
  assert(canonicalMatches.length === 1 && canonicalMatches[0][1] === canonical, `${route} has an inconsistent canonical`);
  assert(html.includes(`<h1>${topic.topic} learning path</h1>`), `${route} lacks a visible H1`);
  assert(html.includes('"@type":"LearningResource"') && html.includes('"@type":"BreadcrumbList"'), `${route} lacks structured data`);
  assert(topic.relatedSlugs.every((slug) => html.includes(`href="/learn/${slug}"`)), `${route} lacks crawlable related links`);
  assert(html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length > 180, `${route} has too little raw HTML content`);
  assert(locations.includes(canonical), `${route} is missing from the sitemap`);
  titles.add(titleMatches[0][1]);
  descriptions.add(descMatches[0][1]);
}

const topicsHtml = readFileSync(join(dist, "topics", "index.html"), "utf-8");
assert(publicTopics.every((topic) => topicsHtml.includes(`href="/learn/${topic.slug}"`)), "/topics does not link every public path");
const feedbackHtml = readFileSync(join(dist, "feedback", "index.html"), "utf-8");
assert(feedbackHtml.includes('<meta name="robots" content="noindex,follow">'), "/feedback must be noindex");
const generatorHtml = readFileSync(join(dist, "learningpath", "index.html"), "utf-8");
assert(generatorHtml.includes('<meta name="robots" content="noindex,follow">'), "/learningpath must be noindex");
const shareHtml = readFileSync(join(dist, "share", "index.html"), "utf-8");
assert(shareHtml.includes('<meta name="robots" content="noindex,nofollow">'), "/share must be noindex,nofollow");
const shareShellHtml = readFileSync(join(dist, "share-shell.html"), "utf-8");
assert(shareShellHtml.includes('<meta name="robots" content="noindex,nofollow">'), "dynamic share shell must be noindex,nofollow");
const rootHtml = readFileSync(join(dist, "index.html"), "utf-8");
assert(rootHtml.includes("data-prerendered") && rootHtml.includes('href="/topics"'), "home page lacks crawlable raw HTML");

console.log("[verify-seo] 27 canonical pages, raw content, sitemap, and crawlable links verified.");
