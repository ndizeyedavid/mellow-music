import { api } from "../api/client";

/**
 * Fire-and-forget taste event to the backend (anonymous profile).
 * Failures are silent — local affinity still works.
 */
export function sendTasteEvent(anonymousId: string, songId: string, eventType: string): void {
  if (!anonymousId || !songId || !eventType) return;
  void api.post("/api/taste/event", {
    anonymous_id: anonymousId,
    song_id: songId,
    event_type: eventType,
  }).catch(() => {
    // best-effort
  });
}

export async function fetchVectorRecommend(anonymousId: string, exclude: string[], limit = 10) {
  if (!anonymousId) return [];
  const { data } = await api.get("/api/recommend/vector", {
    params: { anonymous_id: anonymousId, exclude: exclude.join(","), limit },
  });
  return data.results ?? [];
}
