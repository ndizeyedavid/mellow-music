export type CaptionColor = "accent" | "danger";

export interface ForYouCardData {
  image: string;
  caption: string;
  captionColor: CaptionColor;
  title: string;
  description: string;
}

export interface AlbumItem {
  image: string;
  title: string;
  subtitle: string;
}

export interface AlbumRow {
  title: string;
  items: AlbumItem[];
}

export interface Track {
  title: string;
  artist: string;
  album: string;
  source: string;
  image: string;
  duration?: number;
}

export interface ArtistInfo {
  name: string;
  image: string;
  description: string;
  monthlyListeners: string;
  followers: string;
}

/** Artist profiles shown in the "About the artist" side-panel section. */
export const artistMap: Record<string, ArtistInfo> = {
  "The XX": {
    name: "The XX",
    image: "/assets/img/for-you-coexist.png",
    description:
      "The xx are a minimalist indie pop trio from London. Known for hushed vocals, sparse guitars and moody production, they made their mark with xx, Coexist and I See You.",
    monthlyListeners: "5.4M",
    followers: "1.8M",
  },
  "The Weeknd": {
    name: "The Weeknd",
    image: "/assets/img/for-you-after-hours.png",
    description:
      "The Weeknd is a Canadian singer, songwriter and record producer blending R&B, pop and electronic music. Hits span House of Balloons through After Hours and beyond.",
    monthlyListeners: "92M",
    followers: "31M",
  },
  Moderat: {
    name: "Moderat",
    image: "/assets/img/album-moderat.png",
    description:
      "Moderat is the Berlin trio formed by Modeselektor and Apparat. Their sound fuses glitchy techno with warm, melodic songwriting across albums like II and III.",
    monthlyListeners: "2.1M",
    followers: "890K",
  },
};

/** Demo playback queue for the bottom player. */
export const playerQueue: Track[] = [
  {
    title: "Angels",
    artist: "The XX",
    album: "Coexist",
    source: "/demo.mp3",
    image: "/assets/img/for-you-coexist.png",
    duration: 233,
  },
  {
    title: "After Hours",
    artist: "The Weeknd",
    album: "After Hours",
    source: "/demo.mp3",
    image: "/assets/img/for-you-after-hours.png",
    duration: 233,
  },
  {
    title: "My Mix 1",
    artist: "Stromae, Angèle, Isaac Delusion and more",
    album: "For You",
    source: "/demo.mp3",
    image: "/assets/img/album-mymix-1.png",
    duration: 233,
  },
  {
    title: "Moderat III",
    artist: "Moderat",
    album: "Moderat III",
    source: "/demo.mp3",
    image: "/assets/img/album-moderat.png",
    duration: 233,
  },
];

export const forYouCards: ForYouCardData[] = [
  {
    image: "/assets/img/for-you-new-arrivals.png",
    caption: "New For You",
    captionColor: "danger",
    title: "My New Arrivals",
    description: "Deine Freunde, Moderat, Sebastián Yatra and more",
  },
  {
    image: "/assets/img/for-you-coexist.png",
    caption: "New Track for you",
    captionColor: "accent",
    title: "Coexist",
    description: "Album by The XX",
  },
  {
    image: "/assets/img/for-you-after-hours.png",
    caption: "New Album",
    captionColor: "danger",
    title: "After Hours",
    description: "The Weeknd",
  },
  {
    image: "/assets/img/for-you-if-you-wait.png",
    caption: "Based on your likes",
    captionColor: "danger",
    title: "If You Wait",
    description: "London Grammar",
  },
  {
    image: "/assets/img/for-you-daily-discovery.png",
    caption: "Daily updated mix",
    captionColor: "danger",
    title: "My Daily Discovery",
    description:
      "Songs by new and familiar artists inspired by your listening. Updates every morning.",
  },
  {
    image: "/assets/img/for-you-reggaetoneras.png",
    caption: "Dig Deeper",
    captionColor: "danger",
    title: "Reggaetoneras",
    description: "Created by TIDAL",
  },
  {
    image: "/assets/img/for-you-songwriter.png",
    caption: "Behind the music",
    captionColor: "danger",
    title: "Songwriter: James Blake",
    description: "Kendrick Lamar, Jay Rock, Beyoncé and more",
  },
  {
    image: "/assets/img/for-you-club-azur.png",
    caption: "New Album for you",
    captionColor: "danger",
    title: "Club Azur",
    description: "Album by Kungs",
  },
];

export const albumRows: AlbumRow[] = [
  {
    title: "Albums",
    items: [
      {
        image: "/assets/img/album-blood-sugar.png",
        title: "Blood Sugar Sex Magik (Deluxe Edition)",
        subtitle: "Red Hot Chili Peppers",
      },
      {
        image: "/assets/img/album-multitude.png",
        title: "Multitude",
        subtitle: "Stromae",
      },
      {
        image: "/assets/img/album-daily-discovery.png",
        title: "My Daily Discovery",
        subtitle:
          "Songs by new and familiar artists inspired by your listening. Updates every morning.",
      },
      {
        image: "/assets/img/album-mymix-1.png",
        title: "My Mix 1",
        subtitle: "Stromae, Angèle, Isaac Delusion and more",
      },
      {
        image: "/assets/img/album-mymix-2.png",
        title: "My Mix 2",
        subtitle: "Ghali, Liberato, Coma_Cose and more",
      },
      {
        image: "/assets/img/album-mymix-3.png",
        title: "My Mix 3",
        subtitle: "Lido Pimienta, Romy, Dana Gavanski and more",
      },
      {
        image: "/assets/img/album-mymix-4.png",
        title: "My Mix 4",
        subtitle: "Stephanie Beatriz, Kristen Bell, JD McCrary and more",
      },
      {
        image: "/assets/img/album-moderat.png",
        title: "Moderat III",
        subtitle: "Moderat",
      },
      {
        image: "/assets/img/album-in-your-honor.png",
        title: "In Your Honor",
        subtitle: "Foo Fighters",
      },
      {
        image: "/assets/img/album-in-your-honor-2.png",
        title: "In Your Honor",
        subtitle: "Foo Fighters",
      },
    ],
  },
  {
    title: "Playlists",
    items: [
      {
        image: "/assets/img/album-daily-discovery.png",
        title: "My Daily Discovery",
        subtitle:
          "Songs by new and familiar artists inspired by your listening. Updates every morning.",
      },
      {
        image: "/assets/img/album-mymix-1.png",
        title: "My Mix 1",
        subtitle: "Stromae, Angèle, Isaac Delusion and more",
      },
      {
        image: "/assets/img/album-mymix-2.png",
        title: "My Mix 2",
        subtitle: "Ghali, Liberato, Coma_Cose and more",
      },
      {
        image: "/assets/img/album-mymix-3.png",
        title: "My Mix 3",
        subtitle: "Lido Pimienta, Romy, Dana Gavanski and more",
      },
      {
        image: "/assets/img/album-moderat.png",
        title: "Moderat III",
        subtitle: "Moderat",
      },
      {
        image: "/assets/img/album-blood-sugar.png",
        title: "Blood Sugar Sex Magik (Deluxe Edition)",
        subtitle: "Red Hot Chili Peppers",
      },
      {
        image: "/assets/img/album-in-your-honor.png",
        title: "In Your Honor",
        subtitle: "Foo Fighters",
      },
      {
        image: "/assets/img/album-mellon-collie.png",
        title: "Mellon Collie And The Infinite Sadness (Deluxe Edition)",
        subtitle: "Greatest Hits",
      },
      {
        image: "/assets/img/album-at-swim.png",
        title: "At Swim",
        subtitle: "Lisa Hannigan",
      },
    ],
  },
];
