import { useEffect, useState } from "react";
import { MdCloudDone, MdCloudOff } from "react-icons/md";
import { useNetworkStatus } from "../hooks/useNetworkStatus";

/**
 * Fixed top banner: offline -> persistent, online -> transient success.
 * Offline shell is already cached by the service worker, so the UI stays
 * usable even with no connection.
 */
export function OfflineBanner() {
  const online = useNetworkStatus();
  const [showOnline, setShowOnline] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!online) {
      setWasOffline(true);
      setShowOnline(false);
      return;
    }
    if (wasOffline) {
      setShowOnline(true);
      const timer = window.setTimeout(() => {
        setShowOnline(false);
        setWasOffline(false);
      }, 3000);
      return () => window.clearTimeout(timer);
    }
  }, [online, wasOffline]);

  if (!online) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed left-1/2 top-2 z-[80] flex -translate-x-1/2 items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-[13px]/[18px] font-semibold text-black shadow-xl"
      >
        <MdCloudOff size={16} aria-hidden="true" />
        You’re offline — cached content still works
      </div>
    );
  }

  if (showOnline) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed left-1/2 top-2 z-[80] flex -translate-x-1/2 items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-[13px]/[18px] font-semibold text-white shadow-xl"
      >
        <MdCloudDone size={16} aria-hidden="true" />
        Back online
      </div>
    );
  }

  return null;
}
