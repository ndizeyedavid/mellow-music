import { useRef, useState } from "react";

/**
 * HTML5 drag-to-reorder for queue lists. Returns per-row props plus the
 * current drop target for highlight. Touch devices fall back to the
 * existing buttons (native DnD is pointer-only).
 */
export function useDragReorder(onMove: (from: number, to: number) => void) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  /** Timestamp of the last successful drop (click right after is skipped). */
  const movedAt = useRef(0);

  const reset = () => {
    setDragFrom(null);
    setDropAt(null);
  };

  /** True when a drop just moved a row (then clears; 350ms window). */
  const consumeMoved = (): boolean => {
    const recent = Date.now() - movedAt.current < 350;
    movedAt.current = 0;
    return recent;
  };

  const rowProps = (index: number) => ({
    draggable: true,
    onDragStart: (event: React.DragEvent) => {
      setDragFrom(index);
      event.dataTransfer.effectAllowed = "move";
      try {
        event.dataTransfer.setData("text/plain", String(index));
      } catch {
        // setData required by Firefox; ignore failures.
      }
    },
    onDragOver: (event: React.DragEvent) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setDropAt(index);
    },
    onDragLeave: () => {
      setDropAt((prev) => (prev === index ? null : prev));
    },
    onDrop: (event: React.DragEvent) => {
      event.preventDefault();
      const raw = event.dataTransfer.getData("text/plain");
      const from = dragFrom ?? (raw === "" ? NaN : Number(raw));
      if (Number.isInteger(from) && from !== index) {
        onMove(from, index);
        movedAt.current = Date.now();
      }
      reset();
    },
    onDragEnd: reset,
  });

  return { dragFrom, dropAt, rowProps, consumeMoved };
}
