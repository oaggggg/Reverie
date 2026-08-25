import { request } from "./client.ts";
import type { SongAvailability } from "./types.ts";

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj =>
  value && typeof value === "object" ? (value as Obj) : {};

export async function getSongLikeStatus(
  songIds: number[],
): Promise<Record<number, boolean>> {
  const ids = songIds.filter((id) => Number.isSafeInteger(id) && id > 0);
  if (!ids.length) return {};
  const response = await request<Obj>(
    "/song/like/check",
    { ids: ids.join(",") },
    false,
  );
  const value = response.data ?? response.result ?? response;
  const result: Record<number, boolean> = {};
  if (Array.isArray(value)) {
    for (const raw of value) {
      const item = obj(raw);
      const id = Number(item.id ?? item.songId ?? 0);
      if (id) result[id] = Boolean(item.like ?? item.liked ?? item.isLike);
    }
  } else {
    for (const [key, state] of Object.entries(obj(value))) {
      const id = Number(key);
      if (id) result[id] = Boolean(state);
    }
  }
  return result;
}

export async function getDynamicSongCover(songId: number): Promise<string> {
  if (!songId) return "";
  const response = await request<Obj>(
    "/song/dynamic/cover",
    { id: songId },
    false,
  );
  const value = obj(response.data ?? response.result ?? response);
  return String(
    value.url ?? value.coverUrl ?? value.dynamicCoverUrl ?? value.picUrl ?? "",
  );
}

export async function checkSongAvailability(
  songId: number,
  bitrate = 999000,
): Promise<SongAvailability> {
  if (!songId) return { songId, available: false, message: "歌曲不存在" };
  const response = await request<Obj>(
    "/check/music",
    { id: songId, br: bitrate },
    false,
  );
  const value = obj(response.data ?? response.result ?? response);
  const available = Boolean(
    response.success ??
    value.success ??
    (response.code === 200 && value.code !== 404),
  );
  return {
    songId,
    available,
    message: String(
      response.message ??
        value.message ??
        (available ? "歌曲可播放" : "暂无版权"),
    ),
  };
}
