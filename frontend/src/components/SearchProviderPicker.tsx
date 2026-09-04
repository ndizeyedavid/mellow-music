import { MdCheck } from "react-icons/md";
import {
  PROVIDERS,
  setSearchProvider,
  useSearchProvider,
  type SearchProvider,
} from "../utils/searchProvider";

/**
 * Search engine picker: logo + name + one-line guide per engine.
 * Choosing persists the preference (and dismisses the first-run chooser).
 */
export function SearchProviderPicker({
  onClose,
  title = "Choose search engine",
}: {
  onClose: () => void;
  title?: string;
}) {
  const active = useSearchProvider() ?? "deezer";

  const pick = (id: SearchProvider) => {
    setSearchProvider(id);
    onClose();
  };

  return (
    <div role="menu" aria-label={title}>
      <p className="px-3 pb-1 pt-2 text-[10px]/[12px] font-semibold uppercase tracking-wide text-subtle">
        {title}
      </p>
      {PROVIDERS.map((engine) => {
        const selected = engine.id === active;
        return (
          <button
            key={engine.id}
            type="button"
            role="menuitemradio"
            aria-checked={selected}
            onClick={() => pick(engine.id)}
            className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-white/5 ${
              selected ? "bg-white/5" : ""
            }`}
          >
            <img
              src={engine.logo}
              alt=""
              className="h-7 w-7 shrink-0 object-contain invert"
              loading="lazy"
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-[14px]/[20px] font-semibold text-fg">
                {engine.name}
                {engine.id === "deezer" && (
                  <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px]/[12px] font-bold uppercase tracking-wide text-accent">
                    Default
                  </span>
                )}
              </span>
              <span className="block text-[12px]/[16px] text-subtle">
                {engine.tagline}
              </span>
            </span>
            {selected && (
              <MdCheck size={18} className="shrink-0 text-accent" />
            )}
          </button>
        );
      })}
    </div>
  );
}
