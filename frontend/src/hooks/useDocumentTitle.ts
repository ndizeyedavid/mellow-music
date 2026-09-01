import { useEffect } from "react";

/** Sets document.title to "{title} · Mellow Music" (or "Mellow Music"). */
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · Mellow Music` : "Mellow Music";
  }, [title]);
}
