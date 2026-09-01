/** Full-area loading spinner used as Suspense fallback and page loader. */
export function PageLoader() {
  return (
    <div className="flex h-full min-h-[60vh] items-center justify-center">
      <span
        className="h-9 w-9 animate-spin rounded-full border-2 border-fg/15 border-t-accent"
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}
