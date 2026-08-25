import { getSongsByIds, normalizeSong, request } from "./client.ts";
import type { ListenTogetherRoom, ListenTogetherState, Song } from "./types.ts";

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj =>
  value && typeof value === "object" ? (value as Obj) : {};
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

function numberIds(value: unknown): number[] {
  return arr(value)
    .map((item) => Number(typeof item === "object" ? obj(item).id : item))
    .filter((id) => Number.isSafeInteger(id) && id > 0);
}

function normalizeRoom(raw: unknown): ListenTogetherRoom | null {
  const value = obj(raw);
  const nestedRoom = obj(value.room ?? value.roomInfo);
  const inviter = obj(value.inviter);
  const owner = obj(value.owner);
  const users = arr(value.users ?? nestedRoom.roomUsers);
  const roomId = String(
    value.roomId ?? value.id ?? nestedRoom.roomId ?? nestedRoom.id ?? "",
  );
  if (!roomId) return null;
  return {
    roomId,
    inviterId: Number(value.inviterId ?? inviter.userId ?? 0) || undefined,
    ownerId:
      Number(value.ownerId ?? value.creatorId ?? owner.userId ?? 0) ||
      undefined,
    status: String(value.status ?? value.roomStatus ?? "active"),
    memberCount: Number(
      value.memberCount ??
        value.memberNum ??
        nestedRoom.memberCount ??
        users.length,
    ),
    maxMemberCount: Number(
      value.maxMemberCount ??
        value.maxMemberNum ??
        nestedRoom.maxMemberCount ??
        2,
    ),
    createdAt: Number(
      value.createdAt ?? value.createTime ?? nestedRoom.createTime ?? 0,
    ),
  };
}

function normalizePlaylist(raw: unknown): Song[] {
  const value = obj(raw);
  return arr(value.songs ?? value.playlist ?? value.list ?? raw)
    .map((item) => normalizeSong(obj(item).song ?? item))
    .filter((song): song is Song => song !== null);
}

function extractPlaylistIds(raw: unknown): number[] {
  const value = obj(raw);
  const playlist = obj(value.playlist);
  const displayList = obj(playlist.displayList ?? value.displayList);
  return numberIds(
    displayList.result ??
      displayList.ids ??
      playlist.trackIds ??
      value.trackIds ??
      value.songIds,
  );
}

export async function createListenTogetherRoom(): Promise<ListenTogetherRoom> {
  const response = await request<Obj>(
    "/listentogether/room/create",
    {},
    false,
    { method: "POST" },
  );
  const room = normalizeRoom(response.data ?? response.room ?? response);
  if (!room) throw new Error("创建一起听房间失败");
  return room;
}

export async function checkListenTogetherRoom(
  roomId: string,
): Promise<ListenTogetherRoom> {
  const response = await request<Obj>(
    "/listentogether/room/check",
    { roomId },
    false,
  );
  const room = normalizeRoom(response.data ?? response.room ?? response);
  if (!room) throw new Error("一起听房间不存在");
  return room;
}

export async function getListenTogetherStatus(): Promise<ListenTogetherState> {
  const response = await request<Obj>("/listentogether/status", {}, false);
  const value = obj(response.data ?? response);
  const room = normalizeRoom(value.room ?? value.roomInfo ?? value);
  const playingInfo = obj(value.playingInfo ?? value.playStatusInfo ?? value);
  const rawPlaying = value.playStatus ?? value.playing ?? playingInfo.status;
  const directPlaylist = normalizePlaylist(value);
  return {
    room,
    inRoom: Boolean(value.inRoom ?? room),
    currentSongId: Number(
      value.songId ??
        value.currentSongId ??
        value.playingSongId ??
        playingInfo.trackId ??
        playingInfo.songId ??
        0,
    ),
    playing:
      rawPlaying === true ||
      rawPlaying === 1 ||
      String(rawPlaying ?? "").toUpperCase() === "PLAY",
    progress: Number(
      value.progress ?? value.position ?? playingInfo.progress ?? 0,
    ),
    playlist: directPlaylist.length
      ? directPlaylist
      : await getSongsByIds(extractPlaylistIds(value)),
  };
}

export async function getListenTogetherPlaylist(
  roomId: string,
): Promise<Song[]> {
  const response = await request<Obj>(
    "/listentogether/sync/playlist/get",
    { roomId },
    false,
  );
  const raw = response.data ?? response;
  const direct = normalizePlaylist(raw);
  if (direct.length) return direct;
  return getSongsByIds(extractPlaylistIds(raw));
}

export async function syncListenTogetherPlaylist(input: {
  roomId: string;
  userId: number;
  version: number;
  songIds: number[];
  playMode?: string;
}): Promise<void> {
  const ids = input.songIds.filter((id) => Number.isSafeInteger(id) && id > 0);
  if (!ids.length) throw new Error("同步歌单至少需要一首歌曲");
  await request(
    "/listentogether/sync/list/command",
    {
      roomId: input.roomId,
      commandType: "REPLACE",
      userId: input.userId,
      version: input.version,
      playMode: input.playMode ?? "ORDER_LOOP",
      displayList: ids.join(","),
      randomList: ids.join(","),
    },
    false,
    { method: "POST", json: true },
  );
}

export async function endListenTogetherRoom(roomId: string): Promise<void> {
  await request("/listentogether/end", { roomId }, false, { method: "POST" });
}

export async function acceptListenTogetherInvitation(
  roomId: string,
  inviterId: number,
): Promise<void> {
  await request("/listentogether/accept", { roomId, inviterId }, false, {
    method: "POST",
  });
}

export async function sendListenTogetherHeartbeat(input: {
  roomId: string;
  songId: number;
  playStatus: boolean;
  progress: number;
}): Promise<void> {
  await request(
    "/listentogether/heatbeat",
    {
      roomId: input.roomId,
      songId: input.songId,
      playStatus: input.playStatus,
      progress: input.progress,
    },
    false,
    // JSON body 保持布尔/数字类型；query 序列化会把它们变成字符串，
    // 上游模块原样嵌入 commandInfo 后与官方客户端的指令类型不一致。
    { method: "POST", json: true },
  );
}

export async function sendListenTogetherCommand(input: {
  roomId: string;
  commandType: string;
  progress?: number;
  playStatus?: boolean;
  formerSongId?: number;
  targetSongId?: number;
  clientSeq?: number;
}): Promise<void> {
  await request(
    "/listentogether/play/command",
    {
      roomId: input.roomId,
      commandType: input.commandType,
      progress: input.progress ?? 0,
      playStatus: input.playStatus ?? false,
      formerSongId: input.formerSongId ?? 0,
      targetSongId: input.targetSongId ?? 0,
      clientSeq: input.clientSeq ?? Date.now(),
    },
    false,
    { method: "POST", json: true },
  );
}
