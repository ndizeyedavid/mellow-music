import { MdClose } from "react-icons/md";
import { SidebarContent } from "./Sidebar";

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
}

/** Slide-over drawer replacing the sidebar on small screens. */
export function MobileNav({ open, onClose }: MobileNavProps) {
  return (
    <div
      className={`fixed inset-0 z-40 lg:hidden ${
        open ? "" : "pointer-events-none"
      }`}
      aria-hidden={!open}
    >
      <div
        className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />
      <div
        className={`absolute inset-y-0 left-0 w-64 max-w-[82vw] bg-sidebar shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          type="button"
          aria-label="Close menu"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-fg/70 transition-colors hover:bg-white/10 hover:text-fg"
        >
          <MdClose size={20} />
        </button>
        <div className="h-full overflow-y-auto px-3 pb-8 pt-14">
          <SidebarContent onNavigate={onClose} />
        </div>
      </div>
    </div>
  );
}
