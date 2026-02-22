/**
 * Centralized site metadata used by SEO components, JSON-LD, and sitemaps.
 */

const PROD_URL = "https://www.learn-anything.ca";

export const SITE_URL =
  (import.meta.env.VITE_SITE_URL ?? PROD_URL).replace(/\/$/, "");

export const SITE_NAME = "LearnAnything";

export const SITE_DESCRIPTION =
  "Generate structured learning paths for any topic with AI. " +
  "Beginner to advanced concepts, organized and ready to learn.";

export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-img.png`;

export const AUTHORS = [
  {
    name: "Yixin Tian",
    url: "https://www.yixtian.com",
    github: "https://github.com/yixin0829",
    linkedin: "https://www.linkedin.com/in/yixintian/",
    description:
      "Computer engineer in Toronto interested in human-AI interaction research, personal knowledge management, drumming, and films.",
  },
  {
    name: "James Kokoska",
    url: "https://github.com/jameskokoska",
    github: "https://github.com/jameskokoska",
    description:
      "Frontend and web development enthusiast.",
  },
];
