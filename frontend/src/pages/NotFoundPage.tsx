import { Link } from "react-router-dom";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

/** Fallback for unknown routes. */
export function NotFoundPage() {
  useDocumentTitle("Page not found");
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <p className="text-6xl font-bold text-subtle/40">404</p>
      <h1 className="mt-4 text-2xl/[32px] font-bold text-fg">Page not found</h1>
      <p className="mt-2 max-w-sm text-[14px]/[20px] text-subtle">
        The page you're looking for doesn't exist or was moved.
      </p>
      <Link
        to="/"
        className="mt-6 cursor-pointer rounded-full bg-fg px-6 py-2.5 text-[14px]/[20px] font-semibold text-[#171719] transition-transform hover:scale-105"
      >
        Back home
      </Link>
    </div>
  );
}
