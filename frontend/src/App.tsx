import { useEffect, useRef, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { TopNav } from "./components/TopNav";
import { BottomPlayer } from "./components/BottomPlayer";
import { NowPlayingPanel } from "./components/NowPlayingPanel";
import { PlayerProvider } from "./context/PlayerContext";
import { PlaylistProvider } from "./context/PlaylistContext";
import { ExplorePage } from "./pages/ExplorePage";
import { SearchPage } from "./pages/SearchPage";
import { PlaylistsPage } from "./pages/PlaylistsPage";
import { PlaylistDetailPage } from "./pages/PlaylistDetailPage";
import { AlbumsPage } from "./pages/AlbumsPage";
import { AlbumPage } from "./pages/AlbumPage";
import { TracksPage } from "./pages/TracksPage";
import { ArtistsPage } from "./pages/ArtistsPage";
import { ArtistDetailPage } from "./pages/ArtistDetailPage";
import { SongPage } from "./pages/SongPage";

function AppShell() {
  const [panelOpen, setPanelOpen] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  // Reset scroll on navigation.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="flex h-full overflow-hidden bg-surface font-sans text-fg">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav
          panelOpen={panelOpen}
          onTogglePanel={() => setPanelOpen((open) => !open)}
        />
        <div ref={mainRef} className="flex-1 overflow-y-auto pb-36">
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>

      <NowPlayingPanel open={panelOpen} />

      <BottomPlayer />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <PlaylistProvider>
        <PlayerProvider>
          <AppShell />
        </PlayerProvider>
      </PlaylistProvider>
    </BrowserRouter>
  );
}
