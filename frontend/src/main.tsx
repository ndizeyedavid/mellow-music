import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import NProgress from "nprogress";
import "nprogress/nprogress.css";
import "./index.css";
import App from "./App.tsx";
import { Analytics } from "@vercel/analytics/react";

NProgress.configure({ showSpinner: false });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <Analytics />
  </StrictMode>,
);
