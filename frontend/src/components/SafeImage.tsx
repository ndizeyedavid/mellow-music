import type { ImgHTMLAttributes } from "react";

const FALLBACK =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#1f1f22'/><stop offset='1' stop-color='#171719'/></linearGradient></defs><rect width='300' height='300' fill='url(#g)'/><text x='50%' y='50%' font-family='sans-serif' font-size='44' fill='#9898a6' text-anchor='middle' dominant-baseline='middle'>♪</text></svg>`,
  );

interface SafeImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  onError?: React.ReactEventHandler<HTMLImageElement>;
}

/** <img> that swaps to a music-note placeholder when the source fails to load. */
export function SafeImage({ onError, ...props }: SafeImageProps) {
  return (
    <img
      {...props}
      onError={(event) => {
        onError?.(event);
        event.currentTarget.onerror = null;
        event.currentTarget.src = FALLBACK;
      }}
    />
  );
}
