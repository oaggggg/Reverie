import { create } from "zustand";
import { getRecentCategory } from "../api/recent.ts";
import type {
  RecentAlbum,
  RecentCategory,
  RecentPlaylist,
  RecentRadio,
  SearchMediaInfo,
  Song,
} from "../api/types.ts";
import { usePlayerStore } from "./playerStore.ts";

interface RecentState {
  category: RecentCategory;
  songs: Song[];
  listenSongs: Song[];
  albums: RecentAlbum[];
  playlists: RecentPlaylist[];
  radios: RecentRadio[];
  media: SearchMediaInfo[];
  loading: boolean;
  loadedCategory: RecentCategory | null;
  setCategory: (category: RecentCategory) => Promise<void>;
  load: (category?: RecentCategory) => Promise<void>;
}

let requestToken = 0;

export const useRecentStore = create<RecentState>()((set, get) => ({
  category: "songs",
  songs: [],
  listenSongs: [],
  albums: [],
  playlists: [],
  radios: [],
  media: [],
  loading: false,
  loadedCategory: null,
  setCategory: async (category) => {
    set({ category });
    await get().load(category);
  },
  load: async (category = get().category) => {
    const token = ++requestToken;
    set({ loading: true });
    try {
      const result = await getRecentCategory(category);
      if (token !== requestToken) return;
      set({ ...result, category, loadedCategory: category, loading: false });
    } catch {
      if (token !== requestToken) return;
      set({ loading: false });
      usePlayerStore.getState().toast("加载云端最近记录失败", "error");
    }
  },
}));
