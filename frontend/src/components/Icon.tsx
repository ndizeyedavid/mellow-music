import type { IconType } from "react-icons";
import {
  MdAlbum,
  MdArrowBack,
  MdArrowForward,
  MdCast,
  MdFavorite,
  MdGroup,
  MdMoreHoriz,
  MdMusicNote,
  MdPlayArrow,
  MdPlaylistPlay,
  MdQueueMusic,
  MdRadio,
  MdRepeat,
  MdSearch,
  MdShuffle,
  MdSkipNext,
  MdSkipPrevious,
  MdVideoLibrary,
  MdVolumeUp,
} from "react-icons/md";

const ICONS: Record<string, IconType> = {
  ellipsis: MdMoreHoriz,
  mixes: MdRadio,
  playlists: MdPlaylistPlay,
  albums: MdAlbum,
  tracks: MdMusicNote,
  videos: MdVideoLibrary,
  artists: MdGroup,
  "arrow-left": MdArrowBack,
  "arrow-right": MdArrowForward,
  play: MdPlayArrow,
  search: MdSearch,
  like: MdFavorite,
  shuffle: MdShuffle,
  rewind: MdSkipPrevious,
  forward: MdSkipNext,
  repeat: MdRepeat,
  volume: MdVolumeUp,
  chromecast: MdCast,
  queue: MdQueueMusic,
};

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

/** Icon lookup backed by react-icons (Material Design set). */
export function Icon({ name, size = 16, className }: IconProps) {
  const Component = ICONS[name];
  return <Component size={size} className={className} aria-hidden="true" />;
}
