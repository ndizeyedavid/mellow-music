import { MdChevronRight } from "react-icons/md";
import { Icon } from "./Icon";

/** Round navigation/icon button used in the top bar. */
function RoundButton({
  icon,
  disabled = false,
  label,
}: {
  icon: "arrow-left" | "arrow-right";
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-border bg-elevated transition-colors hover:bg-white/5 disabled:cursor-default disabled:opacity-60"
    >
      <Icon name={icon} size={16} />
    </button>
  );
}

interface TopNavProps {
  panelOpen: boolean;
  onTogglePanel: () => void;
}

export function TopNav({ panelOpen, onTogglePanel }: TopNavProps) {
  return (
    <header className="flex h-[70px] shrink-0 items-center gap-2.5 px-6">
      <RoundButton icon="arrow-left" label="Go back" />
      <RoundButton icon="arrow-right" disabled label="Go forward" />

      <div className="mx-auto flex h-10 w-[389px] max-w-full items-center gap-2.5 rounded-xl border border-border bg-elevated px-2.5">
        <Icon name="search" size={16} />
        <span className="text-[14px]/[20px] text-fg">Search</span>
      </div>

      <button
        type="button"
        aria-label={
          panelOpen ? "Close now playing panel" : "Open now playing panel"
        }
        aria-expanded={panelOpen}
        onClick={onTogglePanel}
        className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border bg-elevated transition-colors hover:bg-white/5 hover:text-accent ${
          panelOpen ? "border-accent/60 text-accent" : "border-border text-fg"
        }`}
      >
        <MdChevronRight
          size={20}
          className={`transition-transform duration-300 ${
            panelOpen ? "" : "rotate-180"
          }`}
        />
      </button>
    </header>
  );
}
