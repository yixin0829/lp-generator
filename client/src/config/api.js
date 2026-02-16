/**
 * Central API configuration for the frontend.
 * Uses BE_API_BASE_URL in Vite; falls back to REACT_APP_API_BASE_URL for CRA compatibility.
 */

const PROD_PLACEHOLDER = "__PROD_API_BASE_URL_PLACEHOLDER__";
const DEV_FALLBACK = "http://localhost:8000";

function isDev() {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return import.meta.env.DEV === true;
  }
  return typeof process !== "undefined" && process.env?.NODE_ENV === "development";
}

/**
 * Returns the base URL for API requests.
 * - Dev: BE_API_BASE_URL or REACT_APP_API_BASE_URL or localhost:8000
 * - Prod: BE_API_BASE_URL or REACT_APP_API_BASE_URL; placeholder triggers warning
 */
export function getApiBaseUrl() {
  const viteUrl =
    typeof import.meta !== "undefined" && import.meta.env?.BE_API_BASE_URL;
  const craUrl =
    typeof process !== "undefined" && process.env?.REACT_APP_API_BASE_URL;
  const url =
    viteUrl ?? craUrl ?? (isDev() ? DEV_FALLBACK : PROD_PLACEHOLDER);

  if (url === PROD_PLACEHOLDER) {
    console.warn(
      "[API] Production API base URL is unset. Set BE_API_BASE_URL in production."
    );
  }
  return url.replace(/\/$/, "");
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
