import { useSyncExternalStore } from "react";

/** Search engines the user can pick. "deezer" is the default. */
export type SearchProvider = "deezer" | "itunes" | "youtube";

export interface ProviderMeta {
  id: SearchProvider;
  name: string;
  tagline: string;
  logo: string;
}

export const PROVIDERS: ProviderMeta[] = [
  {
    id: "deezer",
    name: "Deezer",
    tagline: "Fast with rich metadata and accurate matches. The default.",
    logo: "/img/engines/deezer.svg",
  },
  {
    id: "itunes",
    name: "iTunes",
    tagline: "Apple's catalog. Great for mainstream releases and clean artwork.",
    logo: "/img/engines/itunes.svg",
  },
  {
    id: "youtube",
    name: "YouTube",
    tagline: "Biggest catalog, including covers and rarities. Slower, artwork varies.",
    logo: "/img/engines/youtube.svg",
  },
];

const STORAGE_KEY = "mellow-search-provider";

function readStored(): SearchProvider | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "deezer" || raw === "itunes" || raw === "youtube") return raw;
  } catch {
    // Storage unavailable — treat as first run.
  }
  return null;
}

let provider: SearchProvider | null =
  typeof localStorage === "undefined" ? null : readStored();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): SearchProvider | null {
  return provider;
}

/** The stored engine, or null when the user has never chosen (first run). */
export function useSearchProvider(): SearchProvider | null {
  return useSyncExternalStore(subscribe, getSnapshot);
}

/** Persist the engine choice (also dismisses the first-run chooser). */
export function setSearchProvider(next: SearchProvider): void {
  provider = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Best-effort persistence.
  }
  emit();
}

export function providerMeta(id: SearchProvider): ProviderMeta {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
}

/** Effective engine for queries: stored choice, else the Deezer default. */
export function effectiveProvider(): SearchProvider {
  return provider ?? "deezer";
}
