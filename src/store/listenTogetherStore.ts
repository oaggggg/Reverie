import { create } from "zustand";
import {
  acceptListenTogetherInvitation,
  checkListenTogetherRoom,
  createListenTogetherRoom,
  endListenTogetherRoom,
  getListenTogetherPlaylist,
  getListenTogetherStatus,
  sendListenTogetherCommand,
  sendListenTogetherHeartbeat,
  syncListenTogetherPlaylist,
} from "../api/listenTogether.ts";
import type { ListenTogetherRoom, Song } from "../api/types.ts";
import { usePlayerStore } from "./playerStore.ts";

let heartbeatTimer: number | undefined;
let heartbeatFailures = 0;
let requestToken = 0;

function stopHeartbeat() {
  if (heartbeatTimer !== undefined) {
    window.clearInterval(heartbeatTimer);
    heartbeatTimer = undefined;
  }
  heartbeatFailures = 0;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

interface ListenTogetherState {
  room: ListenTogetherRoom | null;
  playlist: Song[];
  roomIdInput: string;
  inviterIdInput: string;
  loading: boolean;
  syncing: boolean;
  error: string;
  lastCommandSeq: number;
  syncPlaylistVersion: number;
  setRoomIdInput: (value: string) => void;
  setInviterIdInput: (value: string) => void;
  createRoom: () => Promise<void>;
  checkRoom: () => Promise<void>;
  joinRoom: () => Promise<void>;
  refresh: () => Promise<void>;
  syncPlaylist: () => Promise<void>;
  playSynchronizedSong: (song: Song) => Promise<void>;
  sendPlaybackCommand: (
    commandType: "play" | "pause" | "seek" | "goto" | "next" | "prev",
  ) => Promise<void>;
  leaveRoom: () => void;
  endRoom: () => Promise<void>;
  clearError: () => void;
}

function startHeartbeat(roomId: string) {
  stopHeartbeat();
  const send = () => {
    const player = usePlayerStore.getState();
    void sendListenTogetherHeartbeat({
      roomId,
      songId: player.currentSong?.id ?? 0,
      playStatus: player.playing,
      progress: player.progress,
    })
      .then(() => {
        heartbeatFailures = 0;
      })
      .catch(() => {
        // 心跳尽力而为；连续失败视为房间已失效，自动退出避免永久空转。
        heartbeatFailures += 1;
        if (heartbeatFailures >= 3) {
          stopHeartbeat();
          useListenTogetherStore.setState((state) =>
            state.room?.roomId === roomId
              ? {
                  room: null,
                  playlist: [],
                  error: "与一起听房间的连接已断开",
                }
              : state,
          );
        }
      });
  };
  send();
  heartbeatTimer = window.setInterval(send, 10_000);
}

async function loadRoomData(room: ListenTogetherRoom, token: number) {
  const playlist = await getListenTogetherPlaylist(room.roomId).catch(() => []);
  if (token !== requestToken) return;
  useListenTogetherStore.setState({ room, playlist, error: "" });
  startHeartbeat(room.roomId);
}

export const useListenTogetherStore = create<ListenTogetherState>(
  (set, get) => ({
    room: null,
    playlist: [],
    roomIdInput: "",
    inviterIdInput: "",
    loading: false,
    syncing: false,
    error: "",
    lastCommandSeq: 0,
    syncPlaylistVersion: 0,

    setRoomIdInput: (value) => set({ roomIdInput: value }),
    setInviterIdInput: (value) => set({ inviterIdInput: value }),
    clearError: () => set({ error: "" }),

    createRoom: async () => {
      const token = ++requestToken;
      set({ loading: true, error: "" });
      try {
        const room = await createListenTogetherRoom();
        if (token !== requestToken) return;
        set({ room, roomIdInput: room.roomId, loading: false });
        await loadRoomData(room, token);
        usePlayerStore.getState().toast("一起听房间已创建", "success");
      } catch (error) {
        if (token === requestToken) {
          set({
            loading: false,
            error: errorMessage(error, "创建一起听房间失败"),
          });
          usePlayerStore.getState().toast("创建一起听房间失败", "error");
        }
      }
    },

    checkRoom: async () => {
      const roomId = get().roomIdInput.trim();
      if (!roomId) {
        set({ error: "请输入房间号" });
        return;
      }
      const token = ++requestToken;
      set({ loading: true, error: "" });
      try {
        const room = await checkListenTogetherRoom(roomId);
        if (token !== requestToken) return;
        set({ room, loading: false });
        await loadRoomData(room, token);
      } catch (error) {
        if (token === requestToken) {
          set({
            loading: false,
            error: errorMessage(error, "一起听房间不存在"),
          });
        }
      }
    },

    joinRoom: async () => {
      const room = get().room;
      if (!room) {
        await get().checkRoom();
        return;
      }
      const inviterId =
        Number(get().inviterIdInput.trim()) || room.inviterId || room.ownerId;
      if (!inviterId) {
        set({ error: "请输入邀请人用户 ID" });
        return;
      }
      const token = ++requestToken;
      set({ loading: true, error: "" });
      try {
        await acceptListenTogetherInvitation(room.roomId, inviterId);
        const checked = await checkListenTogetherRoom(room.roomId);
        if (token !== requestToken) return;
        set({ room: checked, loading: false });
        await loadRoomData(checked, token);
        usePlayerStore.getState().toast("已加入一起听房间", "success");
      } catch (error) {
        if (token === requestToken) {
          set({
            loading: false,
            error: errorMessage(error, "加入一起听房间失败"),
          });
        }
      }
    },

    refresh: async () => {
      const roomId = get().room?.roomId || get().roomIdInput.trim();
      if (!roomId) return;
      const token = ++requestToken;
      set({ syncing: true, error: "" });
      try {
        const room = await checkListenTogetherRoom(roomId);
        const status = await getListenTogetherStatus().catch(() => null);
        const playlist = await getListenTogetherPlaylist(room.roomId).catch(
          () => [],
        );
        if (token !== requestToken) return;
        const remotePlaylist = playlist.length
          ? playlist
          : (status?.playlist ?? []);
        await applyRemotePlayback(status, remotePlaylist);
        set({
          room,
          playlist: remotePlaylist.length ? remotePlaylist : get().playlist,
          syncing: false,
        });
        startHeartbeat(room.roomId);
      } catch (error) {
        if (token === requestToken) {
          set({
            syncing: false,
            error: errorMessage(error, "刷新一起听状态失败"),
          });
        }
      }
    },

    syncPlaylist: async () => {
      const roomId = get().room?.roomId;
      if (!roomId) return;
      set({ syncing: true, error: "" });
      try {
        const player = usePlayerStore.getState();
        const localIds = player.queue.map((song) => song.id);
        const ownerId =
          get().room?.ownerId ??
          get().room?.inviterId ??
          player.profile?.userId ??
          0;
        if (ownerId > 0 && localIds.length) {
          const version = get().syncPlaylistVersion + 1;
          await syncListenTogetherPlaylist({
            roomId,
            userId: ownerId,
            version,
            songIds: localIds,
          });
          set({ syncPlaylistVersion: version });
        }
        const playlist = await getListenTogetherPlaylist(roomId);
        set({ playlist, syncing: false });
        usePlayerStore
          .getState()
          .toast(`已同步 ${playlist.length} 首歌曲`, "success");
      } catch (error) {
        set({ syncing: false, error: errorMessage(error, "同步歌单失败") });
      }
    },

    playSynchronizedSong: async (song) => {
      const playlist = get().playlist;
      await usePlayerStore
        .getState()
        .playSong(song, playlist.length ? playlist : [song]);
      await get().sendPlaybackCommand("goto");
      await get().sendPlaybackCommand("play");
    },

    sendPlaybackCommand: async (commandType) => {
      const roomId = get().room?.roomId;
      if (!roomId) return;
      const player = usePlayerStore.getState();
      const nextSeq = get().lastCommandSeq + 1;
      set({ lastCommandSeq: nextSeq });
      const wireCommand =
        commandType === "play"
          ? "PLAY"
          : commandType === "pause"
            ? "PAUSE"
            : commandType === "goto"
              ? "GOTO"
              : commandType;
      try {
        await sendListenTogetherCommand({
          roomId,
          commandType: wireCommand,
          progress: player.progress,
          playStatus: player.playing,
          formerSongId: player.currentSong?.id,
          targetSongId: player.currentSong?.id,
          clientSeq: nextSeq,
        });
      } catch (error) {
        set({ error: errorMessage(error, "发送播放同步指令失败") });
      }
    },

    leaveRoom: () => {
      ++requestToken; // 作废在途的房间请求
      stopHeartbeat();
      set({ room: null, playlist: [], roomIdInput: "", loading: false });
    },

    endRoom: async () => {
      const roomId = get().room?.roomId;
      if (!roomId) return;
      const token = ++requestToken;
      set({ loading: true, error: "" });
      try {
        await endListenTogetherRoom(roomId);
        if (token !== requestToken) return;
        stopHeartbeat();
        set({ room: null, playlist: [], roomIdInput: "", loading: false });
        usePlayerStore.getState().toast("一起听房间已结束", "info");
      } catch (error) {
        if (token === requestToken) {
          set({
            loading: false,
            error: errorMessage(error, "结束一起听房间失败"),
          });
        }
      }
    },
  }),
);

async function applyRemotePlayback(
  status: Awaited<ReturnType<typeof getListenTogetherStatus>> | null,
  playlist: Song[],
) {
  if (!status || !status.inRoom) return;
  const player = usePlayerStore.getState();
  const remoteSong = playlist.find((song) => song.id === status.currentSongId);
  if (remoteSong && player.currentSong?.id !== remoteSong.id) {
    await player.playSong(remoteSong, playlist);
  }
  const latest = usePlayerStore.getState();
  if (status.progress > 0) {
    const audio = latest.audioEl;
    if (audio && Number.isFinite(audio.duration)) {
      audio.currentTime = status.progress / 1000;
    }
    usePlayerStore.setState({ progress: status.progress });
  }
  if (latest.currentSong && latest.playing !== status.playing) {
    usePlayerStore.setState({ playing: status.playing });
  }
}
