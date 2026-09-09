export type Song = {
  id: number;
  title: string;
  artist: string;
  audioUrl?: string;
  avgRating?: number;
  createdAt: string;
};

export type Comment = {
  id: number;
  songId: number;
  author: string;
  content: string;
  createdAt: string;
};

export type Rating = {
  id: number;
  songId: number;
  stars: number;
  createdAt: string;
};
