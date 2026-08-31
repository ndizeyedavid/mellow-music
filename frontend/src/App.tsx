import { useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { TopNav } from "./components/TopNav";
import { SectionSlider } from "./components/SectionSlider";
import { ForYouCard } from "./components/ForYouCard";
import { AlbumCard } from "./components/AlbumCard";
import { BottomPlayer } from "./components/BottomPlayer";
import { NowPlayingPanel } from "./components/NowPlayingPanel";
import { PlayerProvider } from "./context/PlayerContext";
import { forYouCards, albumRows } from "./data/library";

function App() {
  const [panelOpen, setPanelOpen] = useState(true);

  return (
    <PlayerProvider>
      <div className="flex h-full overflow-hidden bg-surface font-sans text-fg">
        <Sidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <TopNav
            panelOpen={panelOpen}
            onTogglePanel={() => setPanelOpen((open) => !open)}
          />
          <main className="flex-1 overflow-y-auto pb-36">
            <div className="flex flex-col items-center gap-6 pt-6">
              <SectionSlider title="For You">
                {forYouCards.map((card) => (
                  <ForYouCard key={card.title} {...card} />
                ))}
              </SectionSlider>

              {albumRows.map((row) => (
                <SectionSlider key={row.title} title={row.title} gap="gap-4">
                  {row.items.map((item, i) => (
                    <AlbumCard
                      key={`${row.title}-${item.title}-${i}`}
                      {...item}
                    />
                  ))}
                </SectionSlider>
              ))}
            </div>
          </main>
        </div>

        <NowPlayingPanel open={panelOpen} />

        <BottomPlayer />
      </div>
    </PlayerProvider>
  );
}

export default App;
