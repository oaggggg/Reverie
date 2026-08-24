import { create } from "zustand";
import {
  getMediaDetail,
  getMediaStats,
  getMediaUrl,
  setMediaLiked,
  setMediaSubscribed,
} from "../api/media.ts";
import type { MediaDetail, MediaStats, SearchMediaInfo } from "../api/types.ts";
import { usePlayerStore } from "./playerStore.ts";

interface MediaState {
  visible: boolean;
  item: SearchMediaInfo | null;
  detail: MediaDetail | null;
  url: string;
  stats: MediaStats | null;
  loading: boolean;
  urlLoading: boolean;
  error: string;
  actionLoading: "like" | "subscribe" | "";
  resolution: 720 | 1080;
  open: (item: SearchMediaInfo) => Promise<void>;
  setResolution: (resolution: 720 | 1080) => Promise<void>;
  toggleLike: () => Promise<void>;
  toggleSubscription: () => Promise<void>;
  close: () => void;
}

let token = 0;

export const useMediaStore = create<MediaState>()((set, get) => ({
  visible: false,
  item: null,
  detail: null,
  url: "",
  stats: null,
  loading: false,
  urlLoading: false,
  error: "",
  actionLoading: "",
  resolution: 1080,

  open: async (item) => {
    const current = ++token;
    set({
      visible: true,
      item,
      detail: null,
      url: "",
      stats: null,
      actionLoading: "",
      loading: true,
      urlLoading: true,
      error: "",
    });
    const [detailResult, urlResult, statsResult] = await Promise.allSettled([
      getMediaDetail(item),
      getMediaUrl(item, get().resolution),
      getMediaStats(item),
    ]);
    if (current !== token) return;
    const detail =
      detailResult.status === "fulfilled" ? detailResult.value : null;
    const url = urlResult.status === "fulfilled" ? urlResult.value : "";
    const stats = statsResult.status === "fulfilled" ? statsResult.value : null;
    set({
      detail,
      url,
      stats,
      loading: false,
      urlLoading: false,
      error: detail || url ? "" : "视频详情暂时不可用",
    });
    if (!detail && !url) {
      usePlayerStore.getState().toast("视频详情暂时不可用", "error");
    }
  },

  setResolution: async (resolution) => {
    const item = get().item;
    if (!item || get().resolution === resolution) return;
    const current = ++token;
    set({ resolution, urlLoading: true, url: "" });
    try {
      const url = await getMediaUrl(item, resolution);
      if (current === token) set({ url, urlLoading: false });
    } catch {
      if (current === token) {
        set({ urlLoading: false });
        usePlayerStore.getState().toast("切换清晰度失败", "error");
      }
    }
  },

  toggleLike: async () => {
    const item = get().item;
    const stats = get().stats;
    if (!item || !stats || get().actionLoading) return;
    const liked = !stats.liked;
    set({ actionLoading: "like" });
    try {
      await setMediaLiked(item, liked);
      set({
        actionLoading: "",
        stats: {
          ...stats,
          liked,
          likedCount: Math.max(0, stats.likedCount + (liked ? 1 : -1)),
        },
      });
    } catch (error) {
      set({ actionLoading: "" });
      usePlayerStore
        .getState()
        .toast(
          error instanceof Error ? error.message : "点赞操作失败",
          "error",
        );
    }
  },

  toggleSubscription: async () => {
    const item = get().item;
    const stats = get().stats;
    if (!item || !stats || get().actionLoading) return;
    const subscribed = !stats.subscribed;
    set({ actionLoading: "subscribe" });
    try {
      await setMediaSubscribed(item, subscribed);
      set({
        actionLoading: "",
        stats: {
          ...stats,
          subscribed,
          subCount: Math.max(0, stats.subCount + (subscribed ? 1 : -1)),
        },
      });
    } catch (error) {
      set({ actionLoading: "" });
      usePlayerStore
        .getState()
        .toast(
          error instanceof Error ? error.message : "收藏操作失败",
          "error",
        );
    }
  },

  close: () => {
    const current = ++token;
    set({ visible: false });
    window.setTimeout(() => {
      if (token !== current || get().visible) return;
      set({
        item: null,
        detail: null,
        url: "",
        stats: null,
        loading: false,
        urlLoading: false,
        error: "",
        actionLoading: "",
      });
    }, 240);
  },
}));
