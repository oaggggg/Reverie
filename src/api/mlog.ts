import { request } from "./client.ts";
import type { SearchMediaInfo } from "./types.ts";

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj =>
  value && typeof value === "object" ? (value as Obj) : {};
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

export interface MlogUrlInfo {
  id: string;
  url: string;
  duration: number;
  size: number;
  width: number;
  height: number;
}

function normalizeMlog(raw: unknown): SearchMediaInfo {
  const value = obj(raw);
  const creator = obj(value.creator ?? value.user);
  return {
    id: String(value.id ?? value.mlogId ?? value.vid ?? ""),
    name: String(value.name ?? value.title ?? "动态视频"),
    coverUrl: String(
      value.coverUrl ?? value.cover ?? value.picUrl ?? value.imgurl ?? "",
    ),
    creatorName: String(
      value.creatorName ?? creator.nickname ?? value.artistName ?? "",
    ),
    duration: Number(value.duration ?? value.durationms ?? 0),
    playCount: Number(value.playCount ?? value.playTime ?? 0),
    kind: "video",
  };
}

/** Recommend mlog videos related to a song. */
export async function getMusicMlogRecommendations(
  songId: number,
  mvid = 0,
  limit = 10,
): Promise<SearchMediaInfo[]> {
  if (!songId && !mvid) return [];
  const response = await request<Obj>(
    "/mlog/music/rcmd",
    { songid: songId || undefined, mvid: mvid || undefined, limit },
    false,
  );
  const value = obj(response.data ?? response.result ?? response);
  return arr(
    value.resources ?? value.list ?? value.data ?? response.data ?? response,
  )
    .map(normalizeMlog)
    .filter((item) => item.id);
}

/** Convert an mlog id into the corresponding video id. */
export async function convertMlogToVideoId(mlogId: string): Promise<string> {
  if (!mlogId.trim()) return "";
  const response = await request<Obj>("/mlog/to/video", { id: mlogId }, false);
  const value = obj(response.data ?? response.result ?? response);
  return String(
    value.videoId ?? value.vid ?? value.id ?? response.videoId ?? "",
  );
}

/** Resolve the playable URL and media metadata for an mlog. */
export async function getMlogUrl(
  mlogId: string,
  resolution = 1080,
): Promise<MlogUrlInfo> {
  if (!mlogId.trim()) {
    return { id: "", url: "", duration: 0, size: 0, width: 0, height: 0 };
  }
  const response = await request<Obj>(
    "/mlog/url",
    { id: mlogId, res: resolution },
    false,
  );
  const value = obj(response.data ?? response.result ?? response);
  return {
    id: mlogId,
    url: String(value.url ?? value.videoUrl ?? ""),
    duration: Number(value.duration ?? value.durationms ?? 0),
    size: Number(value.size ?? value.fileSize ?? 0),
    width: Number(value.width ?? 0),
    height: Number(value.height ?? 0),
  };
}
