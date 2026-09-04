import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { Icon, type IconName } from "./Icon";
import { usePlaylists } from "../context/PlaylistContext";

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
        <h2 className="px-3 pb-1 text-[12px]/[12px] font-medium text-subtle">
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
  { label: "Liked Songs", to: "/liked", icon: "like" },
  { label: "Albums", to: "/albums", icon: "albums" },
  { label: "History", to: "/tracks", icon: "tracks" },
  { label: "Artists", to: "/artists", icon: "artists" },
];

export function Sidebar() {
  return (
    <aside className="hidden w-56 shrink-0 flex-col gap-8 overflow-y-auto bg-sidebar px-3 pb-8 pt-4 lg:flex">
      <SidebarContent />
    </aside>
  );
}

/** Sidebar contents shared by the desktop aside and the mobile drawer. */
export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { playlists } = usePlaylists();
  return (
    <>
      <Link
        to="/"
        onClick={onNavigate}
        className="flex items-start justify-center"
        aria-label="Mellow Music home"
      >
        <img
          src="/assets/logo.png"
          alt="Mellow Music"
          width={145}
          className=""
        />
      </Link>

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
        {playlists.length === 0 ? (
          <p className="px-3 py-1 text-[12px]/[16px] text-subtle">
            Create one from the Playlists page.
          </p>
        ) : (
          playlists.map((playlist) => (
            <SidebarLink
              key={playlist.id}
              to={`/playlist/${playlist.id}`}
              label={playlist.name}
              onClick={onNavigate}
            />
          ))
        )}
      </SidebarSection>
    </>
  );
}
