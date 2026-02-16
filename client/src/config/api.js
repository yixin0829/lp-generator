/**
 * Central API configuration for the frontend.
 * Uses VITE_API_BASE_URL in Vite.
 */

const PROD_PLACEHOLDER = "__PROD_API_BASE_URL_PLACEHOLDER__";
const DEV_FALLBACK = "http://localhost:8000";

function isDev() {
  return import.meta.env.DEV;
}

/**
 * Returns the base URL for API requests.
 * - Dev: VITE_API_BASE_URL or localhost:8000
 * - Prod: VITE_API_BASE_URL; placeholder triggers warning
 */
export function getApiBaseUrl() {
  const configuredUrl = import.meta.env.VITE_API_BASE_URL;
  const url = configuredUrl ?? (isDev() ? DEV_FALLBACK : PROD_PLACEHOLDER);

  if (url === PROD_PLACEHOLDER) {
    console.warn(
      "[API] Production API base URL is unset. Set VITE_API_BASE_URL in production."
    );
  }
  return String(url).trim().replace(/\/$/, "");
}

/**
 * Builds a full API URL for the given path.
 * @param {string} path - API path (e.g. "/v1/lp/topic")
 * @returns {string} Full URL
 */
export function apiUrl(path) {
  const base = getApiBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}
