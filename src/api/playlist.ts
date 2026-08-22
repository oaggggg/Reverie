import { cachedRequest, normalizeSong, request } from "./client.ts";
import type { PlaylistDynamicStats, SocialUser, Song } from "./types.ts";

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj =>
  value && typeof value === "object" ? (value as Obj) : {};
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** Record a playlist check-in/play-count update. */
export async function markPlaylistPlayed(playlistId: number): Promise<void> {
  if (!playlistId) return;
  await request("/playlist/update/playcount", { id: playlistId }, false);
}

/** Fetch the complete song records for a playlist, with optional paging. */
export async function getPlaylistAllTracks(
  playlistId: number,
  limit = 1000,
  offset = 0,
): Promise<Song[]> {
  if (!playlistId) return [];
  const response = await cachedRequest<Obj>(
    "/playlist/track/all",
    { id: playlistId, limit, offset },
    5 * 60 * 1000,
  );
  return arr(response.songs ?? response.data ?? response.result)
    .map((raw) => normalizeSong(obj(raw).song ?? raw))
    .filter((song): song is Song => song !== null);
}

export async function addPlaylistTracks(
  playlistId: number,
  songIds: number[],
): Promise<void> {
  if (!playlistId || !songIds.length) return;
  await request(
    "/playlist/track/add",
    { pid: playlistId, ids: songIds.join(",") },
    false,
    { method: "POST" },
  );
}

export async function deletePlaylistTracks(
  playlistId: number,
  songIds: number[],
): Promise<void> {
  if (!playlistId || !songIds.length) return;
  await request(
    "/playlist/track/delete",
    { id: playlistId, ids: songIds.join(",") },
    false,
    { method: "POST" },
  );
}

export async function manipulatePlaylistTracks(
  playlistId: number,
  operation: "add" | "del",
  songIds: number[],
): Promise<void> {
  if (!playlistId || !songIds.length) return;
  await request(
    "/playlist/tracks",
    { op: operation, pid: playlistId, tracks: songIds.join(",") },
    false,
    { method: "POST" },
  );
}

export async function updatePlaylistOrder(
  playlistId: number,
  songIds: number[],
): Promise<void> {
  if (!playlistId || !songIds.length) return;
  try {
    await request(
      "/playlist/order/update",
      { id: playlistId, ids: songIds.join(",") },
      false,
      { method: "POST" },
    );
  } catch {
    // Older NeteaseCloudMusicApi releases expose the same operation under
    // /song/order/update and expect pid instead of id.
    await request(
      "/song/order/update",
      { pid: playlistId, ids: songIds.join(",") },
      false,
      { method: "POST" },
    );
  }
}

export async function getPlaylistDynamicStats(
  playlistId: number,
): Promise<PlaylistDynamicStats> {
  const response = await cachedRequest<Obj>(
    "/playlist/detail/dynamic",
    { id: playlistId, s: 8 },
    5 * 60 * 1000,
  );
  const value = obj(response.data ?? response);
  return {
    playCount: Number(value.playCount ?? value.playcount ?? 0),
    subscribedCount: Number(
      value.subscribedCount ?? value.subCount ?? value.followedCount ?? 0,
    ),
    commentCount: Number(value.commentCount ?? value.commentCountAll ?? 0),
    shareCount: Number(value.shareCount ?? 0),
    followed: Boolean(value.followed ?? value.subscribed ?? value.isSub),
  };
}

export async function getPlaylistSubscribers(
  playlistId: number,
  limit = 20,
  offset = 0,
): Promise<SocialUser[]> {
  if (!playlistId) return [];
  const response = await cachedRequest<Obj>(
    "/playlist/subscribers",
    { id: playlistId, limit, offset },
    10 * 60 * 1000,
  );
  const value = obj(response.data ?? response.result ?? response);
  return arr(value.subscribers ?? value.users ?? value.list ?? response.data ?? response)
    .map((raw) => {
      const item = obj(raw);
      return {
        userId: Number(item.userId ?? item.id ?? 0),
        nickname: String(item.nickname ?? item.name ?? "网易云用户"),
        avatarUrl: String(item.avatarUrl ?? item.avatar ?? ""),
        signature: String(item.signature ?? ""),
        followed: Boolean(item.followed ?? item.mutual ?? false),
        follows: Number(item.follows ?? 0),
        followeds: Number(item.followeds ?? 0),
      } satisfies SocialUser;
    })
    .filter((item) => item.userId > 0);
}
