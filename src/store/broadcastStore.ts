import { create } from "zustand";
import {
  getBroadcastCategories,
  getBroadcastChannels,
  getBroadcastCollected,
  getBroadcastCurrentInfo,
  getSportRadio,
  toggleBroadcastSubscription,
} from "../api/broadcast.ts";
import type {
  BroadcastCategory,
  BroadcastChannel,
  Song,
} from "../api/types.ts";
import { usePlayerStore } from "./playerStore.ts";

let detailToken = 0;
let sportToken = 0;

interface BroadcastState {
  categories: BroadcastCategory[];
  channels: BroadcastChannel[];
  collected: BroadcastChannel[];
  activeChannel: BroadcastChannel | null;
  currentInfoLoading: boolean;
  sportSongs: Song[];
  loading: boolean;
  error: string;
  bpm: number;
  load: () => Promise<void>;
  setBpm: (bpm: number) => Promise<void>;
  toggle: (channel: BroadcastChannel) => Promise<void>;
  playSport: () => Promise<void>;
  openCurrentInfo: (channel: BroadcastChannel) => Promise<void>;
  closeCurrentInfo: () => void;
}
export const useBroadcastStore = create<BroadcastState>((set, get) => ({
  categories: [],
  channels: [],
  collected: [],
  activeChannel: null,
  currentInfoLoading: false,
  sportSongs: [],
  loading: false,
  error: "",
  bpm: 50,
  load: async () => {
    set({ loading: true, error: "" });
    const [categories, channels, collected] = await Promise.allSettled([
      getBroadcastCategories(),
      getBroadcastChannels(),
      getBroadcastCollected(),
    ]);
    set({
      categories: categories.status === "fulfilled" ? categories.value : [],
      channels: channels.status === "fulfilled" ? channels.value : [],
      collected: collected.status === "fulfilled" ? collected.value : [],
      loading: false,
      error: channels.status === "rejected" ? "广播频道暂时不可用" : "",
    });
  },
  setBpm: async (bpm) => {
    const token = ++sportToken;
    set({ bpm, loading: true });
    try {
      const songs = await getSportRadio(bpm);
      if (token !== sportToken) return;
      set({ sportSongs: songs, loading: false });
    } catch {
      if (token !== sportToken) return;
      set({ sportSongs: [], loading: false });
    }
  },
  toggle: async (channel) => {
    try {
      const next = !channel.subscribed;
      await toggleBroadcastSubscription(channel.id, next);
      set({
        channels: get().channels.map((item) =>
          item.id === channel.id ? { ...item, subscribed: next } : item,
        ),
        collected: next
          ? [...get().collected, { ...channel, subscribed: true }]
          : get().collected.filter((item) => item.id !== channel.id),
      });
      usePlayerStore
        .getState()
        .toast(next ? "已收藏广播频道" : "已取消收藏", "success");
    } catch {
      set({ error: "广播频道收藏操作失败" });
    }
  },
  playSport: async () => {
    const songs = get().sportSongs;
    if (songs.length)
      await usePlayerStore.getState().playSong(songs[0]!, songs);
  },
  openCurrentInfo: async (channel) => {
    const token = ++detailToken;
    set({ activeChannel: channel, currentInfoLoading: true });
    try {
      const detail = await getBroadcastCurrentInfo(channel.id);
      if (token !== detailToken) return;
      set({ activeChannel: detail ?? channel, currentInfoLoading: false });
    } catch {
      if (token !== detailToken) return;
      set({ activeChannel: channel, currentInfoLoading: false });
      usePlayerStore.getState().toast("广播频道详情暂时不可用", "error");
    }
  },
  closeCurrentInfo: () => {
    ++detailToken;
    set({ activeChannel: null, currentInfoLoading: false });
  },
}));
