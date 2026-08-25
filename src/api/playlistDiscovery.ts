import { request } from "./client.ts";
import type { PlaylistCategory, PlaylistInfo } from "./types.ts";

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj =>
  value && typeof value === "object" ? (value as Obj) : {};
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

function valuesFrom(response: Obj, ...keys: string[]): unknown[] {
  for (const key of keys) {
    const value = response[key];
    if (Array.isArray(value)) return value;
  }
  const data = obj(response.data);
  for (const key of keys) {
    const value = data[key];
    if (Array.isArray(value)) return value;
  }
  const result = obj(response.result);
  for (const key of keys) {
    const value = result[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function normalizeCategory(raw: unknown): PlaylistCategory | null {
  const value = obj(raw);
  const name = String(value.name ?? value.tagName ?? "").trim();
  if (!name) return null;
  return {
    id: Number(value.id ?? value.category ?? 0),
    name,
    category: Number(value.category ?? value.parentId ?? 0),
    hot: Boolean(value.hot),
    resourceCount: Number(value.resourceCount ?? value.playlistCount ?? 0),
  };
}

function normalizePlaylist(raw: unknown): PlaylistInfo | null {
  const value = obj(raw);
  const creator = obj(value.creator);
  const id = Number(value.id ?? 0);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const tags = arr(value.tags ?? value.tag).map(String).filter(Boolean);
  return {
    id,
    name: String(value.name ?? "歌单"),
    coverImgUrl: String(
      value.coverImgUrl ?? value.coverImgUrlStr ?? value.picUrl ?? "",
    ),
    trackCount: Number(value.trackCount ?? value.trackNumber ?? 0),
    description: String(value.description ?? ""),
    creatorId: Number(creator.userId ?? creator.id ?? 0),
    creatorName: String(creator.nickname ?? creator.name ?? ""),
    // 仅信任显式 subscribed 字段；收藏数>0 不代表当前用户已收藏。
    subscribed:
      value.subscribed === undefined ? false : Boolean(value.subscribed),
    privacy: Number(value.privacy ?? 0),
    tags,
  };
}

function dedupeCategories(items: PlaylistCategory[]): PlaylistCategory[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.id}:${item.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function getPlaylistCategoryList(): Promise<PlaylistCategory[]> {
  const response = await request<Obj>("/playlist/category/list", {}, false);
  return dedupeCategories(
    valuesFrom(response, "data", "categories", "list")
      .map(normalizeCategory)
      .filter((item): item is PlaylistCategory => item !== null),
  );
}

export async function getPlaylistCatlist(): Promise<PlaylistCategory[]> {
  const response = await request<Obj>("/playlist/catlist", {}, false);
  const direct = valuesFrom(response, "sub", "categories", "data", "list")
    .map(normalizeCategory)
    .filter((item): item is PlaylistCategory => item !== null);
  if (direct.length) return dedupeCategories(direct);
  const categories = obj(response.categories ?? obj(response.data).categories);
  return dedupeCategories(
    Object.entries(categories).map(([id, name]) => ({
      id: Number(id),
      name: String(name),
      category: Number(id),
      hot: false,
      resourceCount: 0,
    })),
  );
}

export async function getHotPlaylistTags(): Promise<PlaylistCategory[]> {
  const response = await request<Obj>("/playlist/hot", {}, false);
  return dedupeCategories(
    valuesFrom(response, "tags", "data", "result", "list")
      .map(normalizeCategory)
      .filter((item): item is PlaylistCategory => item !== null),
  );
}

export async function getHighQualityPlaylistTags(): Promise<PlaylistCategory[]> {
  const response = await request<Obj>("/playlist/highquality/tags", {}, false);
  return dedupeCategories(
    valuesFrom(response, "tags", "data", "list", "result")
      .map(normalizeCategory)
      .filter((item): item is PlaylistCategory => item !== null),
  );
}

export async function getHighQualityPlaylists(
  cat = "全部",
  limit = 30,
  before?: number,
): Promise<{ playlists: PlaylistInfo[]; more: boolean; before?: number }> {
  const response = await request<Obj>("/top/playlist/highquality", {
    cat,
    limit,
    before,
  }, false);
  const playlists = valuesFrom(response, "playlists", "data", "result", "list")
    .map(normalizePlaylist)
    .filter((item): item is PlaylistInfo => item !== null);
  const last = obj(playlists.at(-1));
  const nextBefore = Number(response.lasttime ?? response.lastTime ?? last.updateTime ?? 0);
  return {
    playlists,
    more: Boolean(response.more ?? obj(response.data).more),
    before: nextBefore > 0 ? nextBefore : undefined,
  };
}

export async function getPlaylistDiscoveryCategories(): Promise<{
  categories: PlaylistCategory[];
  hotTags: PlaylistCategory[];
  highQualityTags: PlaylistCategory[];
}> {
  const [categoryList, catlist, hotTags, highQualityTags] = await Promise.all([
    getPlaylistCategoryList(),
    getPlaylistCatlist(),
    getHotPlaylistTags(),
    getHighQualityPlaylistTags(),
  ]);
  return {
    categories: dedupeCategories([...categoryList, ...catlist]),
    hotTags,
    highQualityTags,
  };
}
