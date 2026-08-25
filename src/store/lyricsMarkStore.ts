import { create } from "zustand";
import {
  addSongLyricMark,
  deleteSongLyricMarks,
  getSongLyricMarks,
  getUserLyricMarks,
} from "../api/lyricsMark.ts";
import type { LyricMark } from "../api/types.ts";
import { usePlayerStore } from "./playerStore.ts";

interface LyricsMarkState {
  songId: number;
  songName: string;
  songMarks: LyricMark[];
  userMarks: LyricMark[];
  loading: boolean;
  saving: boolean;
  error: string;
  setSong: (songId: number, songName?: string) => void;
  loadSongMarks: () => Promise<void>;
  loadUserMarks: () => Promise<void>;
  add: (mark: {
    startTimeStamp: number;
    originalLyricsText: string;
    translateLyricsText?: string;
  }) => Promise<boolean>;
  remove: (mark: LyricMark) => Promise<void>;
}

let token = 0;

export const useLyricsMarkStore = create<LyricsMarkState>((set, get) => ({
  songId: 0,
  songName: "",
  songMarks: [],
  userMarks: [],
  loading: false,
  saving: false,
  error: "",
  setSong: (songId, songName = "") =>
    set({ songId, songName, songMarks: [], error: "" }),
  loadSongMarks: async () => {
    const songId = get().songId;
    if (!songId) {
      set({ error: "请输入有效歌曲 ID" });
      return;
    }
    const current = ++token;
    set({ loading: true, error: "" });
    try {
      const songMarks = await getSongLyricMarks(songId);
      if (current === token) set({ songMarks, loading: false });
    } catch (error) {
      if (current === token)
        set({
          loading: false,
          error: error instanceof Error ? error.message : "加载歌曲摘录失败",
        });
    }
  },
  loadUserMarks: async () => {
    set({ loading: true, error: "" });
    try {
      const userMarks = await getUserLyricMarks();
      set({ userMarks, loading: false });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : "加载我的歌词本失败",
      });
    }
  },
  add: async (mark) => {
    const songId =
      get().songId || usePlayerStore.getState().currentSong?.id || 0;
    if (!songId || !mark.originalLyricsText.trim()) {
      set({ error: "需要歌曲 ID 和原文摘录" });
      return false;
    }
    set({ saving: true, error: "" });
    try {
      await addSongLyricMark({
        songId,
        marks: [
          { ...mark, originalLyricsText: mark.originalLyricsText.trim() },
        ],
      });
      set({ saving: false });
      await Promise.all([get().loadSongMarks(), get().loadUserMarks()]);
      usePlayerStore.getState().toast("歌词摘录已保存", "success");
      return true;
    } catch (error) {
      set({
        saving: false,
        error: error instanceof Error ? error.message : "保存歌词摘录失败",
      });
      return false;
    }
  },
  remove: async (mark) => {
    set({ saving: true, error: "" });
    try {
      await deleteSongLyricMarks([mark.id]);
      set({
        saving: false,
        songMarks: get().songMarks.filter((item) => item.id !== mark.id),
        userMarks: get().userMarks.filter((item) => item.id !== mark.id),
      });
      usePlayerStore.getState().toast("歌词摘录已删除", "success");
    } catch (error) {
      set({
        saving: false,
        error: error instanceof Error ? error.message : "删除歌词摘录失败",
      });
    }
  },
}));
