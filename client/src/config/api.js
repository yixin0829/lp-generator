/**
 * Central API configuration for the frontend.
 * Uses VITE_API_BASE_URL in Vite.
 */

const DEV_FALLBACK = "http://localhost:8000";
const PROD_FALLBACK = "/api";

function isDev() {
  return import.meta.env.DEV;
}

/**
 * Returns the base URL for API requests.
 * - Dev: VITE_API_BASE_URL or localhost:8000
 * - Prod: VITE_API_BASE_URL or /api (Vercel serverless proxy)
 */
export function getApiBaseUrl() {
  const configuredUrl = import.meta.env.VITE_API_BASE_URL;
  const url = configuredUrl ?? (isDev() ? DEV_FALLBACK : PROD_FALLBACK);
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
