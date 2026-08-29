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
  /** 探测确认有精品歌单的分类名；null 表示尚未探测完成。 */
  probedTagNames: string[] | null;
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

/** 精品标签接口不带数量字段，只能逐个轻量探测（limit=1）确认
    分类下是否真有歌单；分批并发避免一次性打出过多请求。 */
async function probeTagAvailability(names: string[]): Promise<string[]> {
  const available: string[] = [];
  const CHUNK = 8;
  for (let i = 0; i < names.length; i += CHUNK) {
    const results = await Promise.all(
      names.slice(i, i + CHUNK).map(async (name) => ({
        name,
        hasData: await getHighQualityPlaylists(name, 1)
          .then((page) => page.playlists.length > 0)
          .catch(() => false),
      })),
    );
    for (const item of results) if (item.hasData) available.push(item.name);
  }
  return available;
}

export const usePlaylistDiscoveryStore = create<PlaylistDiscoveryState>()(
  (set, get) => ({
    categories: [],
    hotTags: [],
    highQualityTags: [],
    probedTagNames: null,
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
        const firstLoad = !get().loaded;
        const [categories, page] = await Promise.all([
          firstLoad
            ? getPlaylistDiscoveryCategories()
            : Promise.resolve({
                categories: get().categories,
                hotTags: get().hotTags,
                highQualityTags: get().highQualityTags,
              }),
          getHighQualityPlaylists(selectedTag),
        ]);
        const hasPlaylists = page.playlists.length > 0;
        const removeEmptyTag = (items: PlaylistCategory[]) =>
          selectedTag === "全部" || hasPlaylists
            ? items
            : items.filter((item) => item.name !== selectedTag);
        set({
          categories: removeEmptyTag(categories.categories),
          hotTags: removeEmptyTag(categories.hotTags),
          highQualityTags: removeEmptyTag(categories.highQualityTags),
          playlists: page.playlists,
          more: page.more,
          before: page.before,
          loaded: true,
          loading: false,
        });
        // 首次加载后后台探测各分类是否真有数据（标签接口不带数量），
        // 探测完成即从分类栏剔除空分类，无需用户逐个点击才发现。
        if (firstLoad) {
          const names = [
            ...new Set(
              [...categories.highQualityTags, ...categories.hotTags]
                .map((item) => item.name)
                .filter((name) => name && name !== "全部"),
            ),
          ];
          void probeTagAvailability(names).then((available) => {
            if (available.length) set({ probedTagNames: available });
          });
        }
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
