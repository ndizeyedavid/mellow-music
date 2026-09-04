import axios from "axios";

/**
 * Direct axios connection to the Mellow Music backend.
 *
 * No Vite proxy is used — the browser talks straight to the API origin.
 * Configure with `VITE_API_BASE_URL` (no trailing slash, no /api suffix).
 *
 * Defaults to http://127.0.0.1:10020 per backend CoreValues.webPort.
 */
const baseURL = (
  import.meta.env.VITE_API_BASE_URL as string | undefined
)?.trim().replace(/\/+$/, "") || "http://127.0.0.1:10020";

export const api = axios.create({
  baseURL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

export const apiBaseURL = baseURL;
