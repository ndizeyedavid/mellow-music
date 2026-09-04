import { SafeImage } from "./SafeImage";

const GROOVES =
  "repeating-radial-gradient(circle at center, #0b0b0c 0px, #0b0b0c 2px, #232326 3px, #0b0b0c 4px)";

/**
 * The current track's artwork as a spinning vinyl record.
 * Rotates while playing, freezes in place when paused.
 */
export function Vinyl({
  src,
  title,
  spinning,
  className = "h-16 w-16",
}: {
  src: string;
  title: string;
  spinning: boolean;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={`${title} vinyl`}
      className={`relative block shrink-0 animate-[spin_9s_linear_infinite] rounded-full shadow-lg ${className}`}
      style={{
        background: GROOVES,
        animationPlayState: spinning ? "running" : "paused",
      }}
    >
      {/* Light sheen sweeping across the grooves */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background:
            "conic-gradient(from 200deg, transparent 0deg, rgba(255,255,255,0.14) 20deg, transparent 60deg, transparent 180deg, rgba(255,255,255,0.08) 210deg, transparent 250deg)",
        }}
      />
      {/* Center label = the artwork, plus spindle hole */}
      <span className="absolute inset-0 flex items-center justify-center">
        <SafeImage
          src={src}
          alt=""
          className="h-[42%] w-[42%] rounded-full object-cover"
        />
      </span>
      <span
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 h-[6%] w-[6%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-surface"
      />
    </span>
  );
}
