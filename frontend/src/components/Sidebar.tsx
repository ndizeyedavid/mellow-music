import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { Icon, type IconName } from "./Icon";
import { albums, playlists } from "../data/library";

interface SidebarLinkProps {
  to: string;
  label?: string;
  icon?: IconName;
  large?: boolean;
  end?: boolean;
  onClick?: () => void;
}

/** Reusable sidebar row link rendered as a router NavLink. */
export function SidebarLink({
  to,
  label,
  icon,
  large = false,
  end = false,
  onClick,
}: SidebarLinkProps) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        `flex w-full items-center gap-2.5 rounded-lg px-3 py-3 transition-colors ${
          large ? "text-[16px]/[24px]" : "text-[14px]/[24px]"
        } font-medium ${isActive ? "text-accent" : "text-fg hover:bg-white/5"}`
      }
    >
      {icon && (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center">
          <Icon name={icon} size={24} />
        </span>
      )}
      {label && <span className="min-w-0 truncate">{label}</span>}
    </NavLink>
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
  { label: "Home", to: "/", end: true },
  { label: "Explore", to: "/explore" },
  { label: "Search", to: "/search" },
];

const collectionLinks: Array<{ label: string; to: string; icon: IconName }> = [
  { label: "Playlists", to: "/playlists", icon: "playlists" },
  { label: "Albums", to: "/albums", icon: "albums" },
  { label: "Tracks", to: "/tracks", icon: "tracks" },
  { label: "Artists", to: "/artists", icon: "artists" },
];

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
      <SidebarContent />
    </aside>
  );
}

/** Sidebar contents shared by the desktop aside and the mobile drawer. */
export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <UserProfileRow />

      <SidebarSection>
        {navLinks.map((link) => (
          <SidebarLink
            key={link.label}
            to={link.to}
            end={link.end}
            label={link.label}
            large
            onClick={onNavigate}
          />
        ))}
      </SidebarSection>

      <SidebarSection heading="MY COLLECTION">
        {collectionLinks.map((link) => (
          <SidebarLink
            key={link.label}
            to={link.to}
            label={link.label}
            icon={link.icon}
            onClick={onNavigate}
          />
        ))}
      </SidebarSection>

      <SidebarSection heading="MY PLAYLISTS">
        {playlists.map((playlist) => (
          <SidebarLink
            key={playlist.id}
            to={`/playlist/${playlist.id}`}
            label={playlist.name}
            onClick={onNavigate}
          />
        ))}
      </SidebarSection>

      <SidebarSection heading="Imported Albums">
        {albums.map((album) => (
          <SidebarLink
            key={album.id}
            to={`/album/${album.id}`}
            label={album.title}
            onClick={onNavigate}
          />
        ))}
      </SidebarSection>
    </>
  );
}
