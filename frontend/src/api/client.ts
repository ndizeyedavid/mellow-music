import axios from "axios";

/**
 * Shared axios instance for the Mellow Music backend.
 *
 * In dev the Vite server proxies `/api` to the FastAPI backend
 * (see vite.config.ts). In production set VITE_API_BASE_URL to the
 * real backend origin, e.g. `https://api.mellowmusic.app`.
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "",
  timeout: 20_000,
  headers: { Accept: "application/json" },
});
