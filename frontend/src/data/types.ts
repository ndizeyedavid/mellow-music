export interface Track {
  id: string;
  title: string;
  artist: string; // display name
  artistId: string;
  album: string; // display name
  albumId: string;
  image: string;
  source: string;
  duration: number;
  popularity: number; // 0-100
  plays: string;
  releaseDate: string;
  genre: string;
  explicit?: boolean;
  lyrics: string[];
  credits: {
    writers: string[];
    producers: string[];
    label: string;
  };
}

export interface Artist {
  id: string;
  name: string;
  image: string;
  verified: boolean;
  followers: string;
  monthlyListeners: string;
  bio: string;
  relatedIds: string[];
}

export interface Album {
  id: string;
  title: string;
  artistId: string;
  year: number;
  image: string;
  label: string;
  description: string;
  trackIds: string[];
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  image: string;
  owner: string;
  trackIds: string[];
}

export interface Genre {
  name: string;
  image: string;
}
