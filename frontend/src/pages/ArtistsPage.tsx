import { ArtistCard } from "../components/ArtistCard";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { artists } from "../data/library";

/** Grid of all artists. */
export function ArtistsPage() {
  useDocumentTitle("Artists");
  return (
    <div className="px-6 pt-6">
      <h1 className="text-2xl/[32px] font-bold text-fg">Artists</h1>
      <p className="mt-1 text-[14px] text-subtle">
        {artists.length} artists in your library
      </p>
      <div className="mt-6 flex flex-wrap gap-4">
        {artists.map((artist) => (
          <ArtistCard key={artist.id} artist={artist} />
        ))}
      </div>
    </div>
  );
}
