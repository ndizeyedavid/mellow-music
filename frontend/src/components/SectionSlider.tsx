import type { ReactNode } from 'react';
import { Icon } from './Icon';

interface SectionSliderProps {
  title: string;
  gap?: string;
  children: ReactNode;
}

/** Horizontally scrollable row with a heading and nav arrows (Figma "Slider" family). */
export function SectionSlider({ title, gap = 'gap-6', children }: SectionSliderProps) {
  return (
    <section className="w-full max-w-[1156px]">
      <div className="flex items-center justify-between px-8">
        <h2 className="text-[18px]/[24px] font-semibold text-fg">{title}</h2>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label={`Scroll ${title} back`}
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-border bg-elevated p-1 transition-colors hover:bg-white/5"
          >
            <Icon name="arrow-left" size={16} />
          </button>
          <button
            type="button"
            aria-label={`Scroll ${title} forward`}
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-border bg-elevated p-1 opacity-60 transition-colors hover:bg-white/5"
          >
            <Icon name="arrow-right" size={16} />
          </button>
        </div>
      </div>
      <div className={`no-scrollbar flex overflow-x-auto px-8 py-4 ${gap}`}>
        {children}
      </div>
    </section>
  );
}
