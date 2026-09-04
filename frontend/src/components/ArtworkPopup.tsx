import { useEffect, useRef, useState } from "react";
import { MdClose, MdOpenInFull } from "react-icons/md";
import { SafeImage } from "./SafeImage";
import { usePlayer } from "../context/PlayerContext";

const MAX_TILT = 16;

/**
 * Artwork popup: the current cover on a 3D-tilting card that follows the
 * mouse, with a handoff into the fullscreen player.
 */
export function ArtworkPopup({
  onClose,
  onFullscreen,
}: {
  onClose: () => void;
  onFullscreen: () => void;
}) {
  const { currentTrack } = usePlayer();
  const frameRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({
    rx: 0,
    ry: 0,
    gx: 50,
    gy: 50,
    hovering: false,
  });

  // Escape closes.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!currentTrack) return null;

  const handleMove = (event: React.MouseEvent) => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    setTilt({
      rx: -py * MAX_TILT,
      ry: px * (MAX_TILT + 4),
      gx: (px + 0.5) * 100,
      gy: (py + 0.5) * 100,
      hovering: true,
    });
  };

  const resetTilt = () =>
    setTilt({ rx: 0, ry: 0, gx: 50, gy: 50, hovering: false });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Artwork for ${currentTrack.title}`}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close artwork"
        className="absolute right-5 top-5 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
      >
        <MdClose size={24} />
      </button>

      <div
        className="flex w-full max-w-sm flex-col items-center"
        onClick={(event) => event.stopPropagation()}
      >
        {/* 3D stage */}
        <div
          className="w-full"
          style={{ perspective: "1100px" }}
          onMouseMove={handleMove}
          onMouseLeave={resetTilt}
        >
          <div
            ref={frameRef}
            className="relative overflow-hidden rounded-2xl shadow-2xl"
            style={{
              transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale(${tilt.hovering ? 1.02 : 1})`,
              transition: tilt.hovering
                ? "transform 0.08s ease-out"
                : "transform 0.5s ease",
              transformStyle: "preserve-3d",
            }}
          >
            <SafeImage
              src={currentTrack.image}
              alt={`${currentTrack.title} cover`}
              className="aspect-square w-full object-cover"
            />
            {/* Cursor-tracking glare */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 transition-opacity duration-300"
              style={{
                opacity: tilt.hovering ? 1 : 0,
                background: `radial-gradient(circle at ${tilt.gx}% ${tilt.gy}%, rgba(255,255,255,0.28) 0%, transparent 55%)`,
              }}
            />
          </div>
        </div>

        <p className="mt-5 truncate text-xl font-bold text-white">
          {currentTrack.title}
        </p>
        <p className="mt-1 truncate text-[14px]/[20px] text-white/60">
          {currentTrack.artist}
        </p>

        <button
          type="button"
          onClick={onFullscreen}
          className="mt-5 flex cursor-pointer items-center gap-2 rounded-full bg-white px-6 py-2.5 text-[14px]/[20px] font-semibold text-black transition-transform hover:scale-105 active:scale-95"
        >
          <MdOpenInFull size={18} /> Open fullscreen
        </button>
      </div>
    </div>
  );
}
