/**
 * Framework-free connectivity store shared by the API layer (which reports
 * backend failures) and the React connectivity context (which renders banners).
 *
 * Two independent signals:
 *  - networkOnline: browser online/offline events
 *  - backendOnline: set by API calls / health pings
 */

type Listener = () => void;

const listeners = new Set<Listener>();

let networkOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
let backendOnline = true;

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function setNetworkOnline(value: boolean): void {
  if (networkOnline === value) return;
  networkOnline = value;
  notify();
}

export function setBackendOnline(value: boolean): void {
  if (backendOnline === value) return;
  backendOnline = value;
  notify();
}

export function isNetworkOnline(): boolean {
  return networkOnline;
}

export function isBackendOnline(): boolean {
  return backendOnline;
}

export function subscribeConnectivity(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => setNetworkOnline(true));
  window.addEventListener("offline", () => setNetworkOnline(false));
}
