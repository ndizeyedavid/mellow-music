import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

interface SidebarLinkProps {
  label?: string;
  icon?: IconName;
  active?: boolean;
  large?: boolean;
  onClick?: () => void;
}

/** Reusable sidebar row link (Figma "Sidebar-link" component). */
export function SidebarLink({
  label,
  icon,
  active = false,
  large = false,
  onClick,
}: SidebarLinkProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-3 text-left transition-colors ${
        large ? "text-[16px]/[24px]" : "text-[14px]/[24px]"
      } font-medium ${active ? "text-accent" : "text-fg hover:bg-white/5"}`}
    >
      {icon && (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center">
          <Icon name={icon} size={24} />
        </span>
      )}
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}

interface SidebarSectionProps {
  heading?: string;
  children: ReactNode;
}

/** Grouped list with an uppercase section heading (Figma "Sidebar-Section"). */
export function SidebarSection({ heading, children }: SidebarSectionProps) {
  return (
    <section className="flex flex-col gap-1">
      {heading && (
        <h2 className="px-3 pb-1 pt-4 text-[12px]/[12px] font-medium text-subtle">
          {heading}
        </h2>
      )}
      {children}
    </section>
  );
}

const navLinks = [
  { label: "Home", active: true },
  { label: "Explore" },
  { label: "Videos" },
];

const collectionLinks: Array<{ label: string; icon: IconName }> = [
  { label: "Mixes and Radio", icon: "mixes" },
  { label: "Playlists", icon: "playlists" },
  { label: "Albums", icon: "albums" },
  { label: "Tracks", icon: "tracks" },
  { label: "Videos", icon: "videos" },
  { label: "Artists", icon: "artists" },
];

const playlistLabels = [
  "",
  "September",
  "Clubbing",
  "Chil story2",
  "Playlist 342",
  "",
];

const importedAlbumLabels = ["", "", "", "", "", ""];

/** User profile row: avatar circle + ellipsis menu (Figma "Sidebar-link" user variant). */
function UserProfileRow() {
  return (
    <button
      type="button"
      className="flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-3 transition-colors hover:bg-white/5"
    >
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-avatar">
        <span className="text-[10px]/[24px] font-medium tracking-[-0.05em] text-subtle">
          Gi
        </span>
      </span>
      <Icon name="ellipsis" size={24} />
    </button>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col gap-8 overflow-y-auto bg-sidebar px-3 pb-8 pt-4 lg:flex">
      <UserProfileRow />

      <SidebarSection>
        {navLinks.map((link) => (
          <SidebarLink
            key={link.label}
            label={link.label}
            active={link.active}
            large
          />
        ))}
      </SidebarSection>

      <SidebarSection heading="MY COLLECTION">
        {collectionLinks.map((link) => (
          <SidebarLink key={link.label} label={link.label} icon={link.icon} />
        ))}
      </SidebarSection>

      <SidebarSection heading="MY PLAYLISTS">
        {playlistLabels.map((label, i) => (
          <SidebarLink key={`${label}-${i}`} label={label} />
        ))}
      </SidebarSection>

      <SidebarSection heading="Imported Albums">
        {importedAlbumLabels.map((label, i) => (
          <SidebarLink key={`${label}-${i}`} label={label} />
        ))}
      </SidebarSection>
    </aside>
  );
}
