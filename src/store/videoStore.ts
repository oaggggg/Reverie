import { create } from "zustand";
import {
  getExclusiveMvs,
  getMvAll,
  getMvFirst,
  getMvToplist,
  getVideoGroups,
  getVideoTimeline,
  getVideosByGroup,
  getVideoCategories,
  getPlaylistRecentVideos,
  getLikedVideos,
  type MvArea,
  type MvOrder,
  type MvType,
  type VideoGroup,
  type VideoCategory,
} from "../api/videos.ts";
import type { SearchMediaInfo } from "../api/types.ts";
import { usePlayerStore } from "./playerStore.ts";

export type VideoMode = "recommend" | "all" | "group" | "mv-top" | "mv-first" | "mv-all" | "mv-exclusive" | "playlist-recent" | "my-like";

interface VideoState {
  mode: VideoMode;
  groups: VideoGroup[];
  categories: VideoCategory[];
  selectedGroup: number;
  videos: SearchMediaInfo[];
  loading: boolean;
  mvArea: MvArea;
  mvType: MvType;
  mvOrder: MvOrder;
  load: () => Promise<void>;
  setMode: (mode: VideoMode) => Promise<void>;
  selectGroup: (id: number) => Promise<void>;
  setMvFilters: (filters: Partial<Pick<VideoState, "mvArea" | "mvType" | "mvOrder">>) => Promise<void>;
}

async function loadMv(mode: VideoMode, area: MvArea, type: MvType, order: MvOrder): Promise<SearchMediaInfo[]> {
  if (mode === "mv-top") return getMvToplist(area);
  if (mode === "mv-first") return getMvFirst(area);
  if (mode === "mv-exclusive") return getExclusiveMvs();
  return getMvAll(area, type, order);
}

let requestToken = 0;

function beginVideoLoad() {
  return ++requestToken;
}

function isStale(token: number) {
  return token !== requestToken;
}

export const useVideoStore = create<VideoState>()((set) => ({
  mode: "recommend",
  groups: [],
  categories: [],
  selectedGroup: 0,
  videos: [],
  loading: false,
  mvArea: "全部",
  mvType: "全部",
  mvOrder: "上升最快",
  load: async () => {
    const token = beginVideoLoad();
    set({ loading: true });
    const [groups, categories, videos] = await Promise.allSettled([
      getVideoGroups(),
      getVideoCategories(),
      getVideoTimeline("recommend"),
    ]);
    if (isStale(token)) return;
    const groupRows = groups.status === "fulfilled" ? groups.value : [];
    const categoryRows = categories.status === "fulfilled" ? categories.value : [];
    const seen = new Set<number>();
    set({
      groups: [...groupRows, ...categoryRows].filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      }),
      categories: categoryRows,
      videos: videos.status === "fulfilled" ? videos.value : [],
      loading: false,
    });
  },
  setMode: async (mode) => {
    const token = beginVideoLoad();
    set({ mode, selectedGroup: 0, loading: true });
    try {
      const state = useVideoStore.getState();
      const videos = mode === "recommend" || mode === "all"
        ? await getVideoTimeline(mode)
        : mode === "playlist-recent"
          ? await getPlaylistRecentVideos()
          : mode === "my-like"
            ? await getLikedVideos()
            : await loadMv(mode, state.mvArea, state.mvType, state.mvOrder);
      if (isStale(token)) return;
      set({ videos, loading: false });
    } catch {
      if (isStale(token)) return;
      set({ videos: [], loading: false });
      usePlayerStore.getState().toast("加载视频列表失败", "error");
    }
  },
  selectGroup: async (id) => {
    const token = beginVideoLoad();
    set({ mode: "group", selectedGroup: id, loading: true });
    try {
      const videos = await getVideosByGroup(id);
      if (isStale(token)) return;
      set({ videos, loading: false });
    } catch {
      if (isStale(token)) return;
      set({ videos: [], loading: false });
      usePlayerStore.getState().toast("加载视频分组失败", "error");
    }
  },
  setMvFilters: async (filters) => {
    const token = beginVideoLoad();
    const next = { ...useVideoStore.getState(), ...filters };
    set({ ...filters, loading: true });
    try {
      const videos = await loadMv(next.mode, next.mvArea, next.mvType, next.mvOrder);
      if (isStale(token)) return;
      set({ videos, loading: false });
    } catch {
      if (isStale(token)) return;
      set({ videos: [], loading: false });
      usePlayerStore.getState().toast("加载 MV 列表失败", "error");
    }
  },
}));
