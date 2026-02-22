/**
 * URL-safe slug from a topic string.
 * Must stay in sync with the backend's `to_slug()` in saved_lp_service.py.
 */
export function toSlug(topic) {
  return topic
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-{2,}/g, "-");
}

/**
 * Display-friendly title from a slug: "how-to-code" → "How To Code".
 */
export function fromSlug(slug) {
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
