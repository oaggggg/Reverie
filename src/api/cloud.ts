import { normalizeSong, request } from "./client.ts";
import type { CloudSong, Song } from "./types.ts";

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj =>
  value && typeof value === "object" ? (value as Obj) : {};
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

function normalizeCloudSong(raw: unknown): CloudSong | null {
  const item = obj(raw);
  const nested = obj(item.simpleSong ?? item.song ?? item.songInfo);
  const song = normalizeSong({ ...nested, ...item });
  const songId = Number(item.songId ?? nested.id ?? item.id ?? 0);
  if (!song && songId <= 0) return null;
  const base: Song = song ?? {
    id: songId,
    name: String(item.songName ?? item.name ?? "云盘歌曲"),
    artists: String(item.artistName ?? "未知歌手"),
    artistNames: [String(item.artistName ?? "未知歌手")],
    album: String(item.albumName ?? "未知专辑"),
    albumId: Number(item.albumId ?? 0),
    picUrl: String(item.picUrl ?? ""),
    duration: Number(item.duration ?? 0),
    fee: Number(item.fee ?? 0),
  };
  return {
    ...base,
    id: songId || base.id,
    cloudId: Number(item.cloudId ?? item.id ?? songId),
    fileName: String(item.fileName ?? item.songName ?? base.name),
    fileSize: Number(item.fileSize ?? item.size ?? 0),
    bitrate: Number(item.bitrate ?? item.br ?? 0),
    addTime: Number(item.addTime ?? item.addtime ?? 0),
    matchedSongId:
      Number(item.matchedSongId ?? item.adjustSongId ?? 0) || undefined,
  };
}

export async function getCloudSongs(
  limit = 30,
  offset = 0,
): Promise<{ songs: CloudSong[]; total: number; hasMore: boolean }> {
  const res = await request<Obj>("/user/cloud", { limit, offset }, true);
  const songs = arr(res.data ?? res.songs ?? res.cloudSongs)
    .map(normalizeCloudSong)
    .filter((item): item is CloudSong => item !== null);
  const total = Number(res.count ?? res.total ?? obj(res.data).count ?? 0);
  return {
    songs,
    total,
    hasMore: Boolean(res.hasMore ?? offset + songs.length < total),
  };
}

export async function getCloudSongDetails(ids: number[]): Promise<CloudSong[]> {
  if (!ids.length) return [];
  const res = await request<Obj>("/user/cloud/detail", {
    id: ids.join(","),
  });
  return arr(res.data ?? res.songs)
    .map(normalizeCloudSong)
    .filter((item): item is CloudSong => item !== null);
}

export async function deleteCloudSong(id: number): Promise<void> {
  await request("/user/cloud/del", { id }, false, { method: "POST" });
}

export async function matchCloudSong(
  uid: number,
  sid: number,
  adjustSongId: number,
): Promise<void> {
  await request("/cloud/match", { uid, sid, asid: adjustSongId }, false, {
    method: "POST",
  });
}

export async function uploadCloudSong(file: File): Promise<Obj> {
  const body = new FormData();
  body.append("songFile", file, file.name);
  return request<Obj>("/cloud", {}, false, { method: "POST", body });
}

export async function importCloudSong(input: {
  md5: string;
  id?: number;
  bitrate: number;
  fileSize: number;
  song: string;
  artist: string;
  album: string;
  fileType: string;
}): Promise<Obj> {
  return request<Obj>(
    "/cloud/import",
    {
      md5: input.md5,
      id: input.id ?? -2,
      bitrate: input.bitrate,
      fileSize: input.fileSize,
      song: input.song,
      artist: input.artist,
      album: input.album,
      fileType: input.fileType,
    },
    false,
    { method: "POST" },
  );
}
