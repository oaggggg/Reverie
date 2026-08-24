import { create } from "zustand";
import { getChartSongs, getChartSummaries, getChartSummariesV2 } from "../api/charts.ts";
import type { ChartSummary, Song } from "../api/types.ts";
import { usePlayerStore } from "./playerStore.ts";

interface ChartState {
  charts: ChartSummary[];
  selectedId: number;
  songs: Song[];
  loading: boolean;
  songsLoading: boolean;
  /** 每个榜单卡片懒加载缓存的歌曲（完整列表） */
  cardSongs: Record<number, Song[]>;
  cardLoading: Record<number, boolean>;
  load: () => Promise<void>;
  select: (id: number) => Promise<void>;
  loadCard: (id: number) => Promise<void>;
}

let requestToken = 0;

export const useChartStore = create<ChartState>()((set, get) => ({
  charts: [],
  selectedId: 0,
  songs: [],
  loading: false,
  songsLoading: false,
  cardSongs: {},
  cardLoading: {},

  load: async () => {
    const token = ++requestToken;
    set({ loading: true });
    try {
      const [v2, legacy] = await Promise.allSettled([
        getChartSummariesV2(),
        getChartSummaries(),
      ]);
      const rows = [
        ...(v2.status === "fulfilled" ? v2.value : []),
        ...(legacy.status === "fulfilled" ? legacy.value : []),
      ];
      const seen = new Set<number>();
      const charts = rows.filter((chart) => {
        if (seen.has(chart.id)) return false;
        seen.add(chart.id);
        return true;
      });
      if (!charts.length) throw new Error("榜单目录为空");
      if (token !== requestToken) return;
      set({ charts, selectedId: 0, songs: [], loading: false });
    } catch {
      if (token !== requestToken) return;
      set({ charts: [], songs: [], selectedId: 0, loading: false });
      usePlayerStore.getState().toast("加载榜单目录失败", "error");
    }
  },

  select: async (id) => {
    if (!id) {
      set({ selectedId: 0, songs: [], songsLoading: false });
      return;
    }
    const token = ++requestToken;
    set({ selectedId: id, songsLoading: true });
    try {
      const songs = await getChartSongs(id);
      if (token !== requestToken) return;
      set({ songs, songsLoading: false });
    } catch {
      if (token !== requestToken) return;
      set({ songs: [], songsLoading: false });
      usePlayerStore.getState().toast("加载榜单歌曲失败", "error");
    }
  },

  loadCard: async (id) => {
    if (!id || get().cardSongs[id] || get().cardLoading[id]) return;
    set((state) => ({ cardLoading: { ...state.cardLoading, [id]: true } }));
    try {
      const songs = await getChartSongs(id);
      set((state) => ({
        cardSongs: { ...state.cardSongs, [id]: songs },
        cardLoading: { ...state.cardLoading, [id]: false },
      }));
    } catch {
      set((state) => ({
        cardSongs: { ...state.cardSongs, [id]: [] },
        cardLoading: { ...state.cardLoading, [id]: false },
      }));
    }
  },
}));
