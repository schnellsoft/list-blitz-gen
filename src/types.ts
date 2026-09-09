export type Listing = {
  id: string;
  category: string;
  title: string;
  summary: string;
  place: string;
  posted: string;
};

export type BoardData = {
  updated: string;
  harbor: string;
  listings: Listing[];
};

export type LoadSource = "cache" | "network" | "memory";

export type Strategy = "cache-first" | "swr";

export type LoadResult = {
  data: BoardData;
  source: LoadSource;
  durationMs: number;
  background?: Promise<BoardData | null>;
};
