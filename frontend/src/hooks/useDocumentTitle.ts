import { useEffect } from "react";

/**
 * Sets document.title and keeps meta description / OG tags in sync for
 * better SEO on client-side navigations. Falls back to the site defaults.
 */
const SITE_NAME = "Mellow Music";
const DEFAULT_DESC =
  "Discover, play and save your mixes on Mellow Music. No logins, no paywalls, no ads — just music.";

function upsertMeta(selector: string, create: () => HTMLMetaElement) {
  let el = document.querySelector(selector) as HTMLMetaElement | null;
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  return el;
}

export function useDocumentTitle(title?: string, description?: string) {
  useEffect(() => {
    const fullTitle = title ? `${title} · ${SITE_NAME}` : SITE_NAME;
    document.title = fullTitle;

    const desc = description || DEFAULT_DESC;
    upsertMeta('meta[name="description"]', () => {
      const m = document.createElement("meta");
      m.name = "description";
      return m;
    }).content = desc;

    upsertMeta('meta[property="og:title"]', () => {
      const m = document.createElement("meta");
      m.setAttribute("property", "og:title");
      return m;
    }).content = fullTitle;

    upsertMeta('meta[property="og:description"]', () => {
      const m = document.createElement("meta");
      m.setAttribute("property", "og:description");
      return m;
    }).content = desc;

    upsertMeta('meta[name="twitter:title"]', () => {
      const m = document.createElement("meta");
      m.name = "twitter:title";
      return m;
    }).content = fullTitle;

    upsertMeta('meta[name="twitter:description"]', () => {
      const m = document.createElement("meta");
      m.name = "twitter:description";
      return m;
    }).content = desc;
  }, [title, description]);
}
