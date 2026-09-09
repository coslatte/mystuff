export type Song = {
  id: number;
  title: string;
  artist: string;
  duration?: string;
  audioUrl?: string;
  avgRating?: number;
  totalVotes?: number;
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
