import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import NProgress from "nprogress";
import { Sidebar } from "./components/Sidebar";
import { TopNav } from "./components/TopNav";
import { MobileNav } from "./components/MobileNav";
import { BottomPlayer } from "./components/BottomPlayer";
import {
  NowPlayingPanel,
  NowPlayingPanelContent,
} from "./components/NowPlayingPanel";
import { PageLoader } from "./components/PageLoader";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { PlayerProvider } from "./context/PlayerContext";
import { PlaylistProvider } from "./context/PlaylistContext";
import { LibraryProvider } from "./context/LibraryContext";

const lazyPage = (
  factory: () => Promise<{ [key: string]: unknown }>,
  name: string,
) =>
  lazy(() =>
    factory().then((module) => ({
      default: module[name] as React.ComponentType,
    })),
  );

const ExplorePage = lazyPage(
  () => import("./pages/ExplorePage"),
  "ExplorePage",
);
const SearchPage = lazyPage(() => import("./pages/SearchPage"), "SearchPage");
const PlaylistsPage = lazyPage(
  () => import("./pages/PlaylistsPage"),
  "PlaylistsPage",
);
const PlaylistDetailPage = lazyPage(
  () => import("./pages/PlaylistDetailPage"),
  "PlaylistDetailPage",
);
const AlbumsPage = lazyPage(() => import("./pages/AlbumsPage"), "AlbumsPage");
const AlbumPage = lazyPage(() => import("./pages/AlbumPage"), "AlbumPage");
const TracksPage = lazyPage(() => import("./pages/TracksPage"), "TracksPage");
const ArtistsPage = lazyPage(
  () => import("./pages/ArtistsPage"),
  "ArtistsPage",
);
const ArtistDetailPage = lazyPage(
  () => import("./pages/ArtistDetailPage"),
  "ArtistDetailPage",
);
const SongPage = lazyPage(() => import("./pages/SongPage"), "SongPage");
const NotFoundPage = lazyPage(
  () => import("./pages/NotFoundPage"),
  "NotFoundPage",
);

function AppShell() {
  const [panelOpen, setPanelOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  // Reset scroll on navigation.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [location.pathname]);

  // Route progress bar (nprogress).
  useEffect(() => {
    NProgress.start();
    const timer = window.setTimeout(() => NProgress.done(), 400);
    return () => {
      window.clearTimeout(timer);
      NProgress.done();
    };
  }, [location.pathname]);

  return (
    <div className="flex h-full overflow-hidden bg-surface font-sans text-fg">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-fg focus:px-4 focus:py-2 focus:font-semibold focus:text-[#171719]"
      >
        Skip to content
      </a>
      <Sidebar />
      <MobileNav open={navOpen} onClose={() => setNavOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav
          panelOpen={panelOpen}
          onTogglePanel={() => setPanelOpen((open) => !open)}
          onToggleNav={() => setNavOpen((open) => !open)}
        />
        <div
          id="main-content"
          ref={mainRef}
          className="flex-1 overflow-y-auto pb-36"
        >
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<ExplorePage />} />
              <Route path="/explore" element={<ExplorePage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/playlists" element={<PlaylistsPage />} />
              <Route path="/playlist/:id" element={<PlaylistDetailPage />} />
              <Route path="/albums" element={<AlbumsPage />} />
              <Route path="/album/:id" element={<AlbumPage />} />
              <Route path="/tracks" element={<TracksPage />} />
              <Route path="/artists" element={<ArtistsPage />} />
              <Route path="/artist/:id" element={<ArtistDetailPage />} />
              <Route path="/song/:id" element={<SongPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </div>
      </div>

      {/* Desktop inline panel */}
      <div className="hidden shrink-0 md:block">
        <NowPlayingPanel open={panelOpen} />
      </div>

      {/* Mobile panel overlay */}
      {panelOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setPanelOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 animate-slide-in-left bg-elevated shadow-2xl">
            <NowPlayingPanelContent />
          </div>
        </div>
      )}

      <BottomPlayer />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <PlaylistProvider>
          <LibraryProvider>
            <PlayerProvider>
              <AppShell />
            </PlayerProvider>
          </LibraryProvider>
        </PlaylistProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
