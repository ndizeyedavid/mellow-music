import { Link } from "react-router-dom";
import { SafeImage } from "./SafeImage";
import type { AlbumItem } from "../data/library";

interface AlbumCardProps extends AlbumItem {
  to?: string;
}

/** Square album/playlist thumbnail with title, subtitle and label. */
export function AlbumCard({ image, title, subtitle, to }: AlbumCardProps) {
  const content = (
    <>
      <SafeImage
        src={image}
        alt={title}
        className="h-[200px] w-[200px] rounded-[3px] object-cover"
        loading="lazy"
      />
      <div className="flex flex-col gap-1 pt-1">
        <h3 className="line-clamp-2 text-[14px]/[20px] font-semibold text-fg">
          {title}
        </h3>
        <p className="line-clamp-2 text-[14px]/[20px] font-semibold text-fg/65">
          {subtitle}
        </p>
        <p className="text-[10px]/[12px] font-semibold text-subtle">ALBUM</p>
      </div>
    </>
  );

  return to ? (
    <Link to={to} className="w-[200px] shrink-0">
      {content}
    </Link>
  ) : (
    <article className="w-[200px] shrink-0">{content}</article>
  );
}
