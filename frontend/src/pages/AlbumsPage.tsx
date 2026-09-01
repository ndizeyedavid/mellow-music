import { AlbumCard } from "../components/AlbumCard";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { albums, artistById } from "../data/library";

/** Full album library grid. */
export function AlbumsPage() {
  useDocumentTitle("Albums");
  return (
    <div className="px-6 pt-6">
      <h1 className="text-2xl/[32px] font-bold text-fg">Albums</h1>
      <p className="mt-1 text-[14px] text-subtle">
        {albums.length} albums in your library
      </p>
      <div className="mt-6 flex flex-wrap gap-6">
        {albums.map((album) => (
          <AlbumCard
            key={album.id}
            to={`/album/${album.id}`}
            image={album.image}
            title={album.title}
            subtitle={artistById(album.artistId)?.name ?? ""}
          />
        ))}
      </div>
    </div>
  );
}
