import { normalizeSong, request } from "./client.ts";
import type {
  AlbumInfo,
  ArtistInfo,
  PlaylistInfo,
  Song,
  StyleDetail,
  StyleTag,
} from "./types.ts";

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj =>
  value && typeof value === "object" ? (value as Obj) : {};
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

function list(response: Obj, ...keys: string[]): unknown[] {
  const candidates = [response, obj(response.data), obj(response.result)];
  for (const candidate of candidates) {
    for (const key of keys) {
      if (Array.isArray(candidate[key])) return candidate[key] as unknown[];
    }
  }
  return Array.isArray(response.data) ? response.data : [];
}

function normalizeTag(raw: unknown): StyleTag | null {
  const value = obj(raw);
  const id = Number(value.id ?? value.tagId ?? 0);
  const name = String(value.name ?? value.tagName ?? "").trim();
  if (!Number.isSafeInteger(id) || id <= 0 || !name) return null;
  return { id, name, parentId: Number(value.parentId ?? value.categoryId ?? 0) || undefined };
}

function normalizeArtist(raw: unknown): ArtistInfo | null {
  const value = obj(raw);
  const id = Number(value.id ?? value.artistId ?? 0);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return {
    id,
    name: String(value.name ?? "未知歌手"),
    picUrl: String(value.picUrl ?? value.img1v1Url ?? value.cover ?? ""),
    alias: arr(value.alias).map(String).filter(Boolean),
    briefDesc: String(value.briefDesc ?? value.desc ?? ""),
    followed: Boolean(value.followed ?? value.follow),
    musicSize: Number(value.musicSize ?? 0),
    albumSize: Number(value.albumSize ?? 0),
  };
}

function normalizeAlbum(raw: unknown): AlbumInfo | null {
  const value = obj(raw);
  const id = Number(value.id ?? value.albumId ?? 0);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const artist = obj(value.artist);
  const artists = arr(value.artists).map(obj);
  const artistList = artists.length ? artists : artist.id ? [artist] : [];
  return {
    id,
    name: String(value.name ?? "未知专辑"),
    picUrl: String(value.picUrl ?? value.blurPicUrl ?? value.cover ?? ""),
    artistNames: artistList.map((item) => String(item.name ?? "")).filter(Boolean).join(" / "),
    artistIds: artistList.map((item) => Number(item.id ?? 0)).filter((item) => item > 0),
    description: String(value.description ?? value.desc ?? ""),
    publishTime: Number(value.publishTime ?? 0),
    size: Number(value.size ?? value.trackCount ?? 0),
    subscribed: Boolean(value.subscribed ?? value.isSub),
  };
}

function normalizePlaylist(raw: unknown): PlaylistInfo | null {
  const value = obj(raw);
  const id = Number(value.id ?? 0);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const creator = obj(value.creator);
  return {
    id,
    name: String(value.name ?? "歌单"),
    coverImgUrl: String(value.coverImgUrl ?? value.picUrl ?? ""),
    trackCount: Number(value.trackCount ?? value.trackNumber ?? 0),
    description: String(value.description ?? ""),
    creatorId: Number(creator.userId ?? creator.id ?? 0),
    creatorName: String(creator.nickname ?? creator.name ?? ""),
    // 仅信任显式 subscribed 字段；收藏数>0 不代表当前用户已收藏。
    subscribed:
      value.subscribed === undefined ? false : Boolean(value.subscribed),
    privacy: Number(value.privacy ?? 0),
    tags: arr(value.tags).map(String).filter(Boolean),
  };
}

function unique<T extends { id: number }>(items: T[]): T[] {
  const seen = new Set<number>();
  return items.filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)));
}

export async function getStyleTags(): Promise<StyleTag[]> {
  const response = await request<Obj>("/style/list", {}, false);
  return unique(
    list(response, "data", "tags", "list")
      .map(normalizeTag)
      .filter((item): item is StyleTag => item !== null),
  );
}

export async function getStylePreference(): Promise<StyleTag[]> {
  const response = await request<Obj>("/style/preference", {}, false);
  return unique(
    list(response, "tags", "data", "list", "preferences")
      .map(normalizeTag)
      .filter((item): item is StyleTag => item !== null),
  );
}

export async function getStyleDetail(tagId: number): Promise<StyleDetail> {
  const response = await request<Obj>("/style/detail", { tagId }, false);
  const value = obj(response.data ?? response.result ?? response);
  return {
    id: Number(value.id ?? value.tagId ?? tagId),
    name: String(value.name ?? value.tagName ?? "风格"),
    description: String(value.description ?? value.desc ?? ""),
    coverUrl: String(value.coverUrl ?? value.picUrl ?? value.cover ?? ""),
  };
}

export async function getStyleSongs(tagId: number, cursor = 0, size = 20): Promise<Song[]> {
  const response = await request<Obj>("/style/song", { tagId, cursor, size, sort: 0 }, false);
  return unique(
    list(response, "songs", "data", "list")
      .map(normalizeSong)
      .filter((item): item is Song => item !== null),
  );
}

export async function getStyleArtists(tagId: number, cursor = 0, size = 20): Promise<ArtistInfo[]> {
  const response = await request<Obj>("/style/artist", { tagId, cursor, size }, false);
  return unique(
    list(response, "artists", "data", "list")
      .map(normalizeArtist)
      .filter((item): item is ArtistInfo => item !== null),
  );
}

export async function getStyleAlbums(tagId: number, cursor = 0, size = 20): Promise<AlbumInfo[]> {
  const response = await request<Obj>("/style/album", { tagId, cursor, size, sort: 0 }, false);
  return unique(
    list(response, "albums", "data", "list")
      .map(normalizeAlbum)
      .filter((item): item is AlbumInfo => item !== null),
  );
}

export async function getStylePlaylists(tagId: number, cursor = 0, size = 20): Promise<PlaylistInfo[]> {
  const response = await request<Obj>("/style/playlist", { tagId, cursor, size }, false);
  return unique(
    list(response, "playlists", "data", "list")
      .map(normalizePlaylist)
      .filter((item): item is PlaylistInfo => item !== null),
  );
}
