import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MdChevronRight } from "react-icons/md";
import { Icon } from "./Icon";

/** Round navigation/icon button used in the top bar. */
function RoundButton({
  icon,
  disabled = false,
  label,
  onClick,
}: {
  icon: "arrow-left" | "arrow-right";
  disabled?: boolean;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
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
  const navigate = useNavigate();
  const location = useLocation();

  const queryFromUrl = new URLSearchParams(location.search).get("q") ?? "";
  const [query, setQuery] = useState(queryFromUrl);

  useEffect(() => {
    setQuery(queryFromUrl);
  }, [queryFromUrl]);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  const updateSearch = (value: string) => {
    setQuery(value);
    // Live navigation so results update as you type.
    navigate(`/search?q=${encodeURIComponent(value)}`, { replace: true });
  };

  return (
    <header className="flex h-[70px] shrink-0 items-center gap-2.5 px-6">
      <RoundButton
        icon="arrow-left"
        label="Go back"
        onClick={() => navigate(-1)}
      />
      <RoundButton
        icon="arrow-right"
        label="Go forward"
        onClick={() => navigate(1)}
      />

      <form
        onSubmit={submitSearch}
        className="mx-auto flex h-10 w-[389px] max-w-full items-center gap-2.5 rounded-xl border border-border bg-elevated px-2.5 focus-within:border-accent/50"
      >
        <Icon name="search" size={16} />
        <input
          value={query}
          onChange={(event) => updateSearch(event.target.value)}
          placeholder="Search songs, artists, albums…"
          aria-label="Search"
          className="w-full bg-transparent text-[14px]/[20px] text-fg outline-none placeholder:text-subtle"
        />
      </form>

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
