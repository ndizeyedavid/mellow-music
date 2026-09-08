/**
 * Anonymous taste identity — random UUID stored in localStorage, never
 * tied to login. Sent with taste events for collaborative + vector taste.
 */
const KEY = "mellow-id-v1";

export function getAnonymousId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (id && /^[0-9a-f-]{36}$/i.test(id)) return id;
    // Generate UUID v4
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    // Fallback when storage is blocked
    return "anon-fallback";
  }
}
