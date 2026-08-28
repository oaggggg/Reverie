import { create } from "zustand";
import {
  deleteCloudSong,
  getCloudSongDetails,
  getCloudSongs,
  importCloudSong,
  matchCloudSong,
  uploadCloudSong,
} from "../api/cloud.ts";
import type { CloudSong } from "../api/types.ts";
import { usePlayerStore } from "./playerStore.ts";

export type CloudUploadPhase = "idle" | "uploading" | "success" | "error";

interface CloudState {
  songs: CloudSong[];
  total: number;
  offset: number;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  uploadPhase: CloudUploadPhase;
  uploadName: string;
  uploadError: string;
  importing: boolean;
  detail: CloudSong | null;
  detailLoading: boolean;
  matchingId: number;
  deletingId: number;
  load: (refresh?: boolean) => Promise<void>;
  loadMore: () => Promise<void>;
  remove: (song: CloudSong) => Promise<boolean>;
  match: (song: CloudSong, adjustSongId: number) => Promise<boolean>;
  upload: (file: File) => Promise<boolean>;
  importSong: (
    input: Parameters<typeof importCloudSong>[0],
  ) => Promise<boolean>;
  openDetail: (song: CloudSong) => Promise<void>;
  closeDetail: () => void;
  resetUpload: () => void;
}

let requestToken = 0;
let detailToken = 0;
const pageSize = 30;

function toast(text: string, type: "info" | "error" | "success" = "info") {
  usePlayerStore.getState().toast(text, type);
}

export const useCloudStore = create<CloudState>()((set, get) => ({
  songs: [],
  total: 0,
  offset: 0,
  hasMore: false,
  loading: false,
  loadingMore: false,
  uploadPhase: "idle",
  uploadName: "",
  uploadError: "",
  importing: false,
  detail: null,
  detailLoading: false,
  matchingId: 0,
  deletingId: 0,

  load: async (refresh = false) => {
    const token = ++requestToken;
    const offset = refresh ? 0 : get().offset;
    // 已有数据时静默刷新，不再整页 loading 挡住重进页面的用户。
    if (!get().songs.length) set({ loading: true });
    try {
      const result = await getCloudSongs(pageSize, offset);
      if (token !== requestToken) return;
      set({
        songs:
          refresh || offset === 0
            ? result.songs
            : [...get().songs, ...result.songs],
        total: result.total,
        offset: offset + result.songs.length,
        hasMore: result.hasMore && result.songs.length > 0,
      });
    } catch {
      if (token === requestToken)
        toast("加载云盘失败，请确认登录状态", "error");
    } finally {
      if (token === requestToken) set({ loading: false, loadingMore: false });
    }
  },

  loadMore: async () => {
    if (get().loading || get().loadingMore || !get().hasMore) return;
    set({ loadingMore: true });
    await get().load(false);
  },

  remove: async (song) => {
    if (get().deletingId) return false;
    set({ deletingId: song.cloudId || song.id });
    try {
      await deleteCloudSong(song.cloudId || song.id);
      set((state) => ({
        songs: state.songs.filter((item) => item.cloudId !== song.cloudId),
        total: Math.max(0, state.total - 1),
      }));
      toast("已从云盘删除", "success");
      return true;
    } catch {
      toast("删除云盘歌曲失败", "error");
      return false;
    } finally {
      set({ deletingId: 0 });
    }
  },

  match: async (song, adjustSongId) => {
    if (get().matchingId) return false;
    const uid = usePlayerStore.getState().profile?.userId ?? 0;
    if (!uid) {
      toast("请先登录", "info");
      usePlayerStore.getState().setShowLogin(true);
      return false;
    }
    set({ matchingId: song.cloudId || song.id });
    try {
      await matchCloudSong(uid, song.id, adjustSongId);
      set((state) => ({
        songs: state.songs.map((item) =>
          item.cloudId === song.cloudId
            ? { ...item, matchedSongId: adjustSongId }
            : item,
        ),
      }));
      toast("云盘歌曲匹配成功", "success");
      return true;
    } catch {
      toast("匹配云盘歌曲失败", "error");
      return false;
    } finally {
      set({ matchingId: 0 });
    }
  },

  upload: async (file) => {
    if (get().uploadPhase === "uploading") return false;
    set({ uploadPhase: "uploading", uploadName: file.name, uploadError: "" });
    try {
      await uploadCloudSong(file);
      set({ uploadPhase: "success" });
      toast("歌曲已上传到云盘", "success");
      await get().load(true);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "上传失败";
      set({ uploadPhase: "error", uploadError: message });
      toast("上传云盘歌曲失败", "error");
      return false;
    }
  },

  importSong: async (input) => {
    if (get().importing) return false;
    set({ importing: true });
    try {
      await importCloudSong(input);
      toast("歌曲已导入云盘", "success");
      await get().load(true);
      return true;
    } catch {
      toast("导入云盘歌曲失败", "error");
      return false;
    } finally {
      set({ importing: false });
    }
  },

  openDetail: async (song) => {
    const token = ++detailToken;
    set({ detail: song, detailLoading: true });
    try {
      const details = await getCloudSongDetails([song.cloudId || song.id]);
      if (token !== detailToken) return;
      set({ detail: details[0] ?? song, detailLoading: false });
    } catch {
      if (token !== detailToken) return;
      set({ detail: song, detailLoading: false });
      toast("加载云盘歌曲详情失败", "error");
    }
  },

  closeDetail: () => {
    ++detailToken;
    set({ detail: null, detailLoading: false });
  },

  resetUpload: () =>
    set({ uploadPhase: "idle", uploadName: "", uploadError: "" }),
}));
