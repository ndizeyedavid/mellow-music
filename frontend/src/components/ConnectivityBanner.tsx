import { MdCloudOff, MdWifiOff } from "react-icons/md";
import { useConnectivity } from "../context/ConnectivityContext";

/** Slim banner shown when the network or the backend is unreachable. */
export function ConnectivityBanner() {
  const { networkOnline, backendOnline } = useConnectivity();

  if (networkOnline && backendOnline) return null;

  const offlineNetwork = !networkOnline;
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-danger/15 px-4 py-2 text-center text-[13px]/[18px] font-medium text-fg"
    >
      {offlineNetwork ? <MdWifiOff size={16} /> : <MdCloudOff size={16} />}
      <span>
        {offlineNetwork
          ? "You're offline. Showing cached music — reconnects automatically."
          : "Backend is unreachable. Showing cached music — retrying automatically."}
      </span>
    </div>
  );
}
