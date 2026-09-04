import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MdMenu } from "react-icons/md";
import { Icon } from "./Icon";
import { SearchProviderPicker } from "./SearchProviderPicker";
import {
  providerMeta,
  useSearchProvider,
} from "../utils/searchProvider";
import { GoSidebarCollapse } from "react-icons/go";

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
  onToggleNav: () => void;
}

export function TopNav({ panelOpen, onTogglePanel, onToggleNav }: TopNavProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // URL is the source of truth for the submitted query; the input keeps
  // local state so typing feels instant while navigation stays debounced.
  const urlQuery = new URLSearchParams(location.search).get("q") ?? "";
  const [draft, setDraft] = useState(urlQuery);
  const [lastUrlQuery, setLastUrlQuery] = useState(urlQuery);

  // Keep the input in sync with back/forward navigation (render-adjust).
  if (lastUrlQuery !== urlQuery) {
    setLastUrlQuery(urlQuery);
    setDraft(urlQuery);
  }

  // Search engine: stored choice, Deezer until the user picks. First focus
  // with no stored choice opens the chooser automatically.
  const storedProvider = useSearchProvider();
  const engine = providerMeta(storedProvider ?? "deezer");
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleFocus = () => {
    if (storedProvider === null) setPickerOpen(true);
  };

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    navigate(`/search?q=${encodeURIComponent(draft)}`);
  };

  // Debounce live search so results update shortly after the user stops typing.
  const debounceRef = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(debounceRef.current), []);

  const updateSearch = (value: string) => {
    setDraft(value);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/immutability
    debounceRef.current = window.setTimeout(() => {
      navigate(`/search?q=${encodeURIComponent(value)}`, { replace: true });
    }, 250);
  };

  return (
    <header className="flex h-[70px] shrink-0 items-center gap-2.5 px-6">
      <button
        type="button"
        aria-label="Open menu"
        onClick={onToggleNav}
        className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-border bg-elevated text-fg transition-colors hover:bg-white/5 lg:hidden"
      >
        <MdMenu size={20} />
      </button>
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
        className="relative mx-auto flex h-10 w-[389px] max-w-full items-center gap-2.5 rounded-xl border border-border bg-elevated px-2.5 focus-within:border-accent/50"
      >
        <Icon name="search" size={16} />
        <input
          value={draft}
          onChange={(event) => updateSearch(event.target.value)}
          onFocus={handleFocus}
          placeholder="Search songs, artists, albums…"
          aria-label="Search"
          className="w-full bg-transparent text-[14px]/[20px] text-fg outline-none placeholder:text-subtle"
        />
        <button
          type="button"
          onClick={() => setPickerOpen((open) => !open)}
          aria-label={`Search engine: ${engine.name}. Change search engine`}
          aria-haspopup="menu"
          aria-expanded={pickerOpen}
          title={`Search engine: ${engine.name}`}
          className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-white/10"
        >
          <img
            src={engine.logo}
            alt=""
            className="h-5 w-5 object-contain invert"
          />
        </button>

        {pickerOpen && (
          <>
            <div
              aria-hidden="true"
              onClick={() => setPickerOpen(false)}
              className="fixed inset-0 z-40 cursor-default"
            />
            <div className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-3rem)] rounded-xl border border-border bg-elevated p-1.5 shadow-xl-dark">
              <SearchProviderPicker onClose={() => setPickerOpen(false)} />
            </div>
          </>
        )}
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
        <GoSidebarCollapse
          size={20}
          className={`transition-transform duration-300 ${
            panelOpen ? "" : "rotate-180"
          }`}
        />
      </button>
    </header>
  );
}
