import { normalizeSong, request } from "./client.ts";
import type { FirstListenInfo, Song } from "./types.ts";

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj =>
  value && typeof value === "object" ? (value as Obj) : {};
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

function songs(response: Obj): Song[] {
  const candidates = [response, obj(response.data), obj(response.result)];
  for (const candidate of candidates) {
    const list = candidate.songs ?? candidate.resources ?? candidate.list;
    if (Array.isArray(list)) {
      return list
        .map(normalizeSong)
        .filter((item): item is Song => item !== null);
    }
  }
  return [];
}

export async function getIntelligentPlaylist(
  songId: number,
  options: { playlistId?: number; startMusicId?: number; count?: number } = {},
): Promise<Song[]> {
  if (!songId) return [];
  const response = await request<Obj>(
    "/playmode/intelligence/list",
    {
      id: songId,
      pid: options.playlistId,
      sid: options.startMusicId ?? songId,
      count: options.count ?? 8,
    },
    false,
  );
  return songs(response);
}

export async function getSongVector(songIds: number[]): Promise<unknown[]> {
  const ids = songIds.filter((id) => Number.isSafeInteger(id) && id > 0);
  if (!ids.length) return [];
  const response = await request<Obj>(
    "/playmode/song/vector",
    { ids: ids.join(",") },
    false,
  );
  const value = response.data ?? response.result ?? response;
  return arr(value);
}

export async function getFirstListenInfo(
  songId: number,
): Promise<FirstListenInfo | null> {
  if (!songId) return null;
  const response = await request<Obj>(
    "/music/first/listen/info",
    { id: songId },
    false,
  );
  const value = obj(response.data ?? response.result ?? response);
  const firstTime = Number(
    value.firstTime ?? value.time ?? value.firstListenTime ?? 0,
  );
  const playCount = Number(value.playCount ?? value.count ?? 0);
  if (!firstTime && !playCount && !value.description && !value.desc)
    return null;
  return {
    songId,
    firstTime,
    playCount,
    description: String(value.description ?? value.desc ?? value.content ?? ""),
  };
}
