import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

interface MarqueeProps {
  children: ReactNode;
  className?: string;
}

/**
 * Scrolls long text horizontally (Spotify-style marquee).
 * Only animates when the content overflows its container; pauses on hover.
 */
export function Marquee({ children, className = "" }: MarqueeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const check = () => setOverflows(el.scrollWidth > el.clientWidth);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [children]);

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden whitespace-nowrap ${className}`}
    >
      {overflows ? (
        <div className="marquee-track">
          <span className="pr-8">{children}</span>
          <span className="pr-8" aria-hidden="true">
            {children}
          </span>
        </div>
      ) : (
        <span className="inline-block truncate">{children}</span>
      )}
    </div>
  );
}
