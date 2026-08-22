import { cachedRequest, request } from "./client.ts";
import type { AlbumInfo, AlbumPrivilege, ArtistInfo } from "./types.ts";

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj =>
  value && typeof value === "object" ? (value as Obj) : {};
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

function rows(response: Obj, ...keys: string[]): unknown[] {
  const candidates = [response, obj(response.data), obj(response.result), obj(response.albums)];
  for (const candidate of candidates) {
    for (const key of keys) {
      if (Array.isArray(candidate[key])) return candidate[key] as unknown[];
    }
  }
  return Array.isArray(response.data) ? response.data : [];
}

function normalizeAlbum(raw: unknown): AlbumInfo | null {
  const value = obj(raw);
  const id = Number(value.id ?? value.albumId ?? 0);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const artist = obj(value.artist);
  const artists = arr(value.artists).map(obj);
  const list = artists.length ? artists : artist.id ? [artist] : [];
  return {
    id,
    name: String(value.name ?? "未知专辑"),
    picUrl: String(value.picUrl ?? value.blurPicUrl ?? value.coverImgUrl ?? ""),
    artistNames: list.map((item) => String(item.name ?? "")).filter(Boolean).join(" / "),
    artistIds: list.map((item) => Number(item.id ?? 0)).filter((item) => item > 0),
    description: String(value.description ?? value.desc ?? ""),
    publishTime: Number(value.publishTime ?? value.publishTimeMs ?? 0),
    size: Number(value.size ?? value.trackCount ?? 0),
    subscribed: Boolean(value.subscribed ?? value.isSub),
  };
}

function normalizeArtist(raw: unknown): ArtistInfo | null {
  const value = obj(raw);
  const id = Number(value.id ?? value.artistId ?? 0);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return {
    id,
    name: String(value.name ?? "未知歌手"),
    picUrl: String(value.picUrl ?? value.img1v1Url ?? value.picUrlUrl ?? ""),
    alias: arr(value.alias).map(String).filter(Boolean),
    briefDesc: String(value.briefDesc ?? value.desc ?? ""),
    followed: Boolean(value.followed ?? value.follow),
    musicSize: Number(value.musicSize ?? 0),
    albumSize: Number(value.albumSize ?? 0),
  };
}

function unique<T extends { id: number }>(items: T[]): T[] {
  const seen = new Set<number>();
  return items.filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)));
}

export type AlbumArea = "ALL" | "ZH" | "EA" | "KR" | "JP";

export async function getAlbumDirectory(
  area: AlbumArea = "ALL",
  offset = 0,
  limit = 30,
): Promise<{ albums: AlbumInfo[]; more: boolean }> {
  const response = await request<Obj>("/album/new", { area, offset, limit }, false);
  const albums = unique(
    rows(response, "albums", "data", "list")
      .map(normalizeAlbum)
      .filter((item): item is AlbumInfo => item !== null),
  );
  const total = Number(response.total ?? response.count ?? obj(response.data).total ?? 0);
  return { albums, more: Boolean(response.more) || (total > 0 && offset + albums.length < total) };
}

export async function getNewestAlbums(): Promise<AlbumInfo[]> {
  const response = await request<Obj>("/album/newest", {}, false);
  return unique(
    rows(response, "albums", "data", "list")
      .map(normalizeAlbum)
      .filter((item): item is AlbumInfo => item !== null),
  );
}

export async function getTopAlbums(area: AlbumArea = "ALL", offset = 0, limit = 30): Promise<AlbumInfo[]> {
  const response = await request<Obj>("/top/album", { area, offset, limit }, false);
  return unique(
    rows(response, "albums", "data", "list")
      .map(normalizeAlbum)
      .filter((item): item is AlbumInfo => item !== null),
  );
}

export async function getAlbumPrivileges(id: number): Promise<AlbumPrivilege[]> {
  if (!id) return [];
  const response = await cachedRequest<Obj>("/album/privilege", { id }, 10 * 60 * 1000);
  const value = obj(response.data ?? response.result ?? response);
  const rows = arr(value.data ?? value.list ?? response.data ?? response);
  return rows
    .map((raw) => {
      const item = obj(raw);
      const songId = Number(item.id ?? item.songId ?? 0);
      const maxBitrate = Number(item.maxbr ?? item.maxBitrate ?? item.br ?? 0);
      return {
        songId,
        maxBitrate,
        standard: Boolean(item.pl ?? item.standard ?? maxBitrate > 0),
        lossless: Boolean(item.fl ?? item.lossless ?? item.hq),
        highRes: Boolean(item.hr ?? item.highRes ?? item.hires),
        dolby: Boolean(item.db ?? item.dolby),
        spatialAudio: Boolean(item.jm ?? item.spatialAudio ?? item.jyeffect),
      } satisfies AlbumPrivilege;
    })
    .filter((item) => item.songId > 0);
}

export async function getArtistDirectory(
  area = -1,
  type = 1,
  initial?: string,
  offset = 0,
  limit = 30,
): Promise<{ artists: ArtistInfo[]; more: boolean }> {
  const response = await request<Obj>("/artist/list", { area, type, initial, offset, limit }, false);
  const artists = unique(
    rows(response, "artists", "data", "list")
      .map(normalizeArtist)
      .filter((item): item is ArtistInfo => item !== null),
  );
  const total = Number(response.total ?? response.count ?? obj(response.data).total ?? 0);
  return { artists, more: Boolean(response.more) || (total > 0 && offset + artists.length < total) };
}

export async function getTopArtists(offset = 0, limit = 50): Promise<ArtistInfo[]> {
  const response = await request<Obj>("/top/artists", { offset, limit }, false);
  return unique(
    rows(response, "artists", "data", "list")
      .map(normalizeArtist)
      .filter((item): item is ArtistInfo => item !== null),
  );
}
