export type Song = {
  id: number;
  title: string;
  artist: string;
  duration?: string;
  audioUrl?: string;
  avgRating?: number;
  totalVotes?: number;
  myRating?: number;
};

export type Comment = {
  id: number;
  songId: number;
  author: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  editToken?: string;
};

export type Rating = {
  id: number;
  songId: number;
  stars: number;
  createdAt: string;
};

export type SoundCloudAlbum = {
  id: string;
  title: string;
  artworkUrl?: string;
  trackCount?: number;
  releaseDate?: string;
  setType?: string;
  url: string;
  artist?: string;
  embedHeight?: number;
};

export type StreamingPlatform = "soundcloud" | "spotify";

export type AlbumLink = {
  platform: StreamingPlatform;
  url: string;
};

export type Album = {
  id: string;
  title: string;
  artworkUrl?: string;
  trackCount?: number;
  releaseDate?: string;
  setType?: string;
  artist?: string;
  links: AlbumLink[];
  embedHeight?: number;
};
