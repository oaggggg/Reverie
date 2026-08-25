import { create } from "zustand";
import {
  getHighQualityPlaylists,
  getPlaylistDiscoveryCategories,
} from "../api/playlistDiscovery";
import type { PlaylistCategory, PlaylistInfo } from "../api/types";
import { usePlayerStore } from "./playerStore";

interface PlaylistDiscoveryState {
  categories: PlaylistCategory[];
  hotTags: PlaylistCategory[];
  highQualityTags: PlaylistCategory[];
  playlists: PlaylistInfo[];
  selectedTag: string;
  loading: boolean;
  loadingMore: boolean;
  more: boolean;
  before?: number;
  loaded: boolean;
  load: (tag?: string) => Promise<void>;
  loadMore: () => Promise<void>;
}

function showError(message: string) {
  usePlayerStore.getState().toast(message, "error");
}

export const usePlaylistDiscoveryStore = create<PlaylistDiscoveryState>()(
  (set, get) => ({
    categories: [],
    hotTags: [],
    highQualityTags: [],
    playlists: [],
    selectedTag: "全部",
    loading: false,
    loadingMore: false,
    more: false,
    before: undefined,
    loaded: false,

    load: async (tag = get().selectedTag) => {
      const selectedTag = tag.trim() || "全部";
      set({ loading: true, selectedTag, playlists: [], before: undefined });
      try {
        const [categories, page] = await Promise.all([
          get().loaded
            ? Promise.resolve({
                categories: get().categories,
                hotTags: get().hotTags,
                highQualityTags: get().highQualityTags,
              })
            : getPlaylistDiscoveryCategories(),
          getHighQualityPlaylists(selectedTag),
        ]);
        set({
          categories: categories.categories,
          hotTags: categories.hotTags,
          highQualityTags: categories.highQualityTags,
          playlists: page.playlists,
          more: page.more,
          before: page.before,
          loaded: true,
          loading: false,
        });
      } catch {
        set({ loading: false, more: false, before: undefined });
        showError("加载歌单发现失败");
      }
    },

    loadMore: async () => {
      const { selectedTag, before, more, loading, loadingMore } = get();
      if (!more || loading || loadingMore) return;
      set({ loadingMore: true });
      try {
        const page = await getHighQualityPlaylists(selectedTag, 30, before);
        set((state) => ({
          playlists: [...state.playlists, ...page.playlists],
          more: page.more,
          before: page.before,
          loadingMore: false,
        }));
      } catch {
        set({ loadingMore: false });
        showError("加载更多精品歌单失败");
      }
    },
  }),
);
