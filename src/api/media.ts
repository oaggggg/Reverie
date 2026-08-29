import { request } from "./client.ts";
import type { MediaDetail, MediaStats, SearchMediaInfo } from "./types.ts";

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj =>
  value && typeof value === "object" ? (value as Obj) : {};
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

function normalizeMedia(raw: unknown, fallback: SearchMediaInfo): MediaDetail {
  const value = obj(raw);
  const creator = obj(value.creator);
  const artists = arr(value.artists).map(obj);
  const artistIds = artists
    .map((item) => Number(item.userId ?? item.id ?? 0))
    .filter((id) => id > 0);
  const tags = arr(value.tags ?? value.videoGroup)
    .map((item) => String(obj(item).name ?? item))
    .filter(Boolean);
  return {
    ...fallback,
    name: String(value.name ?? value.title ?? fallback.name),
    coverUrl: String(
      value.cover ?? value.coverUrl ?? value.imgurl ?? fallback.coverUrl,
    ),
    creatorName: String(
      value.artistName ?? creator.nickname ?? fallback.creatorName,
    ),
    duration: Number(value.duration ?? value.durationms ?? fallback.duration),
    playCount: Number(value.playCount ?? value.playTime ?? fallback.playCount),
    description: String(value.desc ?? value.description ?? ""),
    publishTime: Number(value.publishTime ?? value.publishTimeMs ?? 0),
    tags,
    artistIds,
    commentCount: Number(value.commentCount ?? value.commentNum ?? 0),
    subCount: Number(
      value.subCount ?? value.subedCount ?? value.subscribeCount ?? 0,
    ),
  };
}

export function normalizeMediaDetail(
  raw: unknown,
  fallback: SearchMediaInfo,
): MediaDetail {
  return normalizeMedia(raw, fallback);
}

export async function getMediaDetail(
  item: SearchMediaInfo,
): Promise<MediaDetail> {
  const response =
    item.kind === "mv"
      ? await request<Obj>("/mv/detail", { mvid: item.id }, true)
      : await request<Obj>("/video/detail", { id: item.id }, true);
  const data = obj(response.data ?? response.mv ?? response.video);
  return normalizeMedia(data, item);
}

export async function getMediaUrl(
  item: SearchMediaInfo,
  resolution = 1080,
): Promise<string> {
  if (item.kind === "mv") {
    const response = await request<Obj>(
      "/mv/url",
      { id: item.id, r: resolution },
      false,
    );
    return String(obj(response.data).url ?? "");
  }
  const response = await request<Obj>(
    "/video/url",
    { id: item.id, res: resolution },
    false,
  );
  const urls = arr(response.urls);
  return String(obj(urls[0]).url ?? "");
}

export async function getMediaStats(
  item: SearchMediaInfo,
): Promise<MediaStats> {
  const response =
    item.kind === "mv"
      ? await request<Obj>("/mv/detail/info", { mvid: item.id }, false)
      : await request<Obj>("/video/detail/info", { vid: item.id }, false);
  const value = obj(response.data ?? response.result ?? response);
  return {
    likedCount: Number(value.likedCount ?? value.liked ?? 0),
    shareCount: Number(value.shareCount ?? value.share ?? 0),
    commentCount: Number(value.commentCount ?? value.comment ?? 0),
    subCount: Number(value.subCount ?? value.subscribeCount ?? 0),
    liked: Boolean(value.liked ?? value.likedByUser ?? value.isLiked),
    subscribed: Boolean(
      value.subed ?? value.subscribed ?? value.isSubscribed ?? value.isSub,
    ),
  };
}

export async function setMediaLiked(
  item: SearchMediaInfo,
  liked: boolean,
): Promise<void> {
  await request(
    "/resource/like",
    {
      type: item.kind === "mv" ? 1 : 5,
      id: item.id,
      t: liked ? 1 : 0,
    },
    false,
    { method: "POST" },
  );
}

export async function setMediaSubscribed(
  item: SearchMediaInfo,
  subscribed: boolean,
): Promise<void> {
  await request(
    item.kind === "mv" ? "/mv/sub" : "/video/sub",
    item.kind === "mv"
      ? { mvid: item.id, t: subscribed ? 1 : 0 }
      : { id: item.id, t: subscribed ? 1 : 0 },
    false,
    { method: "POST" },
  );
}
