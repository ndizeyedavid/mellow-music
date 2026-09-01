import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api } from "../api/client";
import {
  isBackendOnline,
  isNetworkOnline,
  setBackendOnline,
  subscribeConnectivity,
} from "../api/connectivity";

interface ConnectivityState {
  networkOnline: boolean;
  backendOnline: boolean;
}

const ConnectivityContext = createContext<ConnectivityState>({
  networkOnline: true,
  backendOnline: true,
});

/** Detects network + backend reachability and exposes it to banners/pages. */
export function ConnectivityProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConnectivityState>({
    networkOnline: isNetworkOnline(),
    backendOnline: isBackendOnline(),
  });

  // React to browser online/offline events and API-reported backend status.
  useEffect(
    () =>
      subscribeConnectivity(() =>
        setState({
          networkOnline: isNetworkOnline(),
          backendOnline: isBackendOnline(),
        }),
      ),
    [],
  );

  // Periodic health ping so the banner clears when the backend comes back.
  useEffect(() => {
    let cancelled = false;
    const ping = async () => {
      try {
        await api.get("/health", { timeout: 5000 });
        if (!cancelled) setBackendOnline(true);
      } catch {
        if (!cancelled) setBackendOnline(false);
      }
    };
    void ping();
    const timer = window.setInterval(ping, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <ConnectivityContext.Provider value={state}>
      {children}
    </ConnectivityContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConnectivity(): ConnectivityState {
  return useContext(ConnectivityContext);
}
