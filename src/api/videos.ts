import { request } from "./client.ts";
import type { SearchMediaInfo } from "./types.ts";

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj =>
  value && typeof value === "object" ? (value as Obj) : {};
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

function normalizeVideo(raw: unknown): SearchMediaInfo {
  const value = obj(raw);
  const creator = obj(value.creator);
  return {
    id: String(value.vid ?? value.id ?? ""),
    name: String(value.name ?? value.title ?? "未命名视频"),
    coverUrl: String(
      value.coverUrl ?? value.cover ?? value.imgurl ?? value.picUrl ?? "",
    ),
    creatorName: String(
      value.creatorName ?? value.artistName ?? creator.nickname ?? "",
    ),
    duration: Number(value.duration ?? value.durationms ?? 0),
    playCount: Number(value.playCount ?? value.playTime ?? 0),
    kind: "video",
  };
}

function extractVideos(response: Obj): SearchMediaInfo[] {
  const data = obj(response.data ?? response.result ?? response);
  return arr(
    data.datas ?? data.videos ?? data.list ?? response.data ?? response.result,
  )
    .map(normalizeVideo)
    .filter((item) => item.id);
}

export interface VideoGroup {
  id: number;
  name: string;
}
export interface VideoCategory {
  id: number;
  name: string;
}

export type MvArea = "全部" | "内地" | "港台" | "欧美" | "日本" | "韩国";
export type MvType = "全部" | "官方版" | "原生" | "现场版" | "网易出品";
export type MvOrder = "上升最快" | "最热" | "最新";

function extractMvs(response: Obj): SearchMediaInfo[] {
  const data = obj(response.data ?? response.result ?? response);
  return arr(
    data.data ?? data.mvs ?? data.list ?? response.data ?? response.mvs,
  )
    .map((raw) => {
      const value = obj(raw);
      const artist = obj(value.artist);
      return {
        id: String(value.id ?? value.mvId ?? value.vid ?? ""),
        name: String(value.name ?? value.title ?? "未命名 MV"),
        coverUrl: String(
          value.cover ?? value.coverUrl ?? value.imgurl ?? value.picUrl ?? "",
        ),
        creatorName: String(
          value.artistName ?? value.creatorName ?? artist.name ?? "",
        ),
        duration: Number(value.duration ?? value.durationms ?? 0),
        playCount: Number(value.playCount ?? value.playTime ?? 0),
        kind: "mv",
      } satisfies SearchMediaInfo;
    })
    .filter((item) => item.id);
}

export async function getMvToplist(
  area: MvArea = "全部",
  limit = 30,
  offset = 0,
): Promise<SearchMediaInfo[]> {
  return extractMvs(
    await request<Obj>(
      "/top/mv",
      { area: area === "全部" ? undefined : area, limit, offset },
      false,
    ),
  );
}

export async function getMvFirst(
  area: MvArea = "全部",
  limit = 30,
  offset = 0,
): Promise<SearchMediaInfo[]> {
  return extractMvs(
    await request<Obj>(
      "/mv/first",
      { area: area === "全部" ? undefined : area, limit, offset },
      false,
    ),
  );
}

export async function getMvAll(
  area: MvArea = "全部",
  type: MvType = "全部",
  order: MvOrder = "上升最快",
  limit = 30,
  offset = 0,
): Promise<SearchMediaInfo[]> {
  return extractMvs(
    await request<Obj>("/mv/all", { area, type, order, limit, offset }, false),
  );
}

export async function getExclusiveMvs(
  limit = 30,
  offset = 0,
): Promise<SearchMediaInfo[]> {
  return extractMvs(
    await request<Obj>("/mv/exclusive/rcmd", { limit, offset }, false),
  );
}

export async function getVideoTimeline(
  mode: "recommend" | "all" = "recommend",
  offset = 0,
): Promise<SearchMediaInfo[]> {
  const path =
    mode === "recommend" ? "/video/timeline/recommend" : "/video/timeline/all";
  return extractVideos(await request<Obj>(path, { offset }, false));
}

export async function getVideoGroups(): Promise<VideoGroup[]> {
  const response = await request<Obj>("/video/group/list", {}, false);
  const data = obj(response.data ?? response.result ?? response);
  return arr(data.data ?? data.list ?? response.data ?? response)
    .map((raw) => {
      const value = obj(raw);
      return {
        id: Number(value.id ?? value.groupId ?? 0),
        name: String(value.name ?? value.title ?? ""),
      };
    })
    .filter((item) => item.id > 0 && item.name);
}

export async function getVideoCategories(
  offset = 0,
  limit = 99,
): Promise<VideoCategory[]> {
  const response = await request<Obj>(
    "/video/category/list",
    { offset, limit },
    false,
  );
  const data = obj(response.data ?? response.result ?? response);
  return arr(
    data.data ?? data.categories ?? data.list ?? response.data ?? response,
  )
    .map((raw) => {
      const value = obj(raw);
      return {
        id: Number(value.id ?? value.categoryId ?? value.groupId ?? 0),
        name: String(value.name ?? value.title ?? value.categoryName ?? ""),
      } satisfies VideoCategory;
    })
    .filter((item) => item.id > 0 && item.name);
}

export async function getVideosByGroup(
  groupId: number,
  offset = 0,
): Promise<SearchMediaInfo[]> {
  if (!groupId) return [];
  return extractVideos(
    await request<Obj>("/video/group", { id: groupId, offset }, false),
  );
}

export async function getPlaylistRecentVideos(): Promise<SearchMediaInfo[]> {
  return extractVideos(await request<Obj>("/playlist/video/recent", {}, true));
}

export async function getLikedVideos(
  time = "-1",
  limit = 12,
): Promise<SearchMediaInfo[]> {
  return extractVideos(
    await request<Obj>("/playlist/mylike", { time, limit }, true),
  );
}
