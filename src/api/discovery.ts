import { cachedRequest, normalizeSong } from "./client.ts";
import type { PlaylistInfo, SearchMediaInfo, Song } from "./types.ts";

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj =>
  value && typeof value === "object" ? (value as Obj) : {};
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** 推荐内容缓存：推荐内容低频变化，切页重进不再全量重拉。 */
const DISCOVERY_TTL = 10 * 60 * 1000;

function normalizePlaylist(raw: unknown): PlaylistInfo | null {
  const value = obj(raw);
  const creator = obj(value.creator);
  const id = Number(value.id ?? 0);
  if (!id) return null;
  return {
    id,
    name: String(value.name ?? "推荐歌单"),
    coverImgUrl: String(value.picUrl ?? value.coverImgUrl ?? value.cover ?? ""),
    trackCount: Number(value.trackCount ?? 0),
    playCount: Number(value.playCount ?? value.playcount ?? 0),
    description: String(value.copywriter ?? value.description ?? ""),
    creatorId: Number(creator.userId ?? creator.id ?? 0),
    creatorName: String(creator.nickname ?? creator.name ?? ""),
    subscribed: Boolean(value.subscribed ?? false),
    privacy: Number(value.privacy ?? 0),
  };
}

export async function getRecommendResources(): Promise<PlaylistInfo[]> {
  const response = await cachedRequest<Obj>(
    "/recommend/resource",
    {},
    DISCOVERY_TTL,
  );
  const data = obj(response.data ?? response.result);
  return arr(response.recommend ?? data.recommend ?? response.data ?? response)
    .map(normalizePlaylist)
    .filter((item): item is PlaylistInfo => item !== null);
}

export async function getPersonalizedNewSongs(limit = 12): Promise<Song[]> {
  const response = await cachedRequest<Obj>(
    "/personalized/newsong",
    { limit },
    DISCOVERY_TTL,
  );
  return arr(response.result ?? response.data)
    .map((raw) => normalizeSong(obj(raw).song ?? raw))
    .filter((song): song is Song => song !== null);
}

function mediaList(response: Obj, kind: "mv" | "video"): SearchMediaInfo[] {
  return arr(response.result ?? response.data)
    .map((raw) => {
      const value = obj(raw);
      return {
        id: String(value.id ?? value.vid ?? ""),
        name: String(value.name ?? value.title ?? "未命名内容"),
        coverUrl: String(
          value.picUrl ?? value.cover ?? value.coverUrl ?? value.imgurl ?? "",
        ),
        creatorName: String(
          value.artistName ?? obj(value.creator).nickname ?? "",
        ),
        duration: Number(value.duration ?? value.durationms ?? 0),
        playCount: Number(value.playCount ?? 0),
        kind,
      } satisfies SearchMediaInfo;
    })
    .filter((item) => item.id);
}

export async function getPersonalizedMvs(): Promise<SearchMediaInfo[]> {
  return mediaList(
    await cachedRequest<Obj>("/personalized/mv", {}, DISCOVERY_TTL),
    "mv",
  );
}

export async function getPrivateContent(): Promise<SearchMediaInfo[]> {
  return mediaList(
    await cachedRequest<Obj>(
      "/personalized/privatecontent",
      {},
      DISCOVERY_TTL,
    ),
    "video",
  );
}

export async function getPrivateContentList(
  limit = 12,
  offset = 0,
): Promise<SearchMediaInfo[]> {
  return mediaList(
    await cachedRequest<Obj>(
      "/personalized/privatecontent/list",
      { limit, offset },
      DISCOVERY_TTL,
    ),
    "video",
  );
}
