import { cachedRequest, request } from "./client.ts";
import type { AlbumInfo, AlbumPrivilege, ArtistInfo } from "./types.ts";

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj =>
  value && typeof value === "object" ? (value as Obj) : {};
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

function rows(response: Obj, ...keys: string[]): unknown[] {
  const candidates = [
    response,
    obj(response.data),
    obj(response.result),
    obj(response.albums),
  ];
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
    artistNames: list
      .map((item) => String(item.name ?? ""))
      .filter(Boolean)
      .join(" / "),
    artistIds: list
      .map((item) => Number(item.id ?? 0))
      .filter((item) => item > 0),
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
  return items.filter((item) =>
    seen.has(item.id) ? false : (seen.add(item.id), true),
  );
}

export type AlbumArea = "ALL" | "ZH" | "EA" | "KR" | "JP";

export async function getAlbumDirectory(
  area: AlbumArea = "ALL",
  offset = 0,
  limit = 30,
): Promise<{ albums: AlbumInfo[]; more: boolean }> {
  const response = await request<Obj>(
    "/album/new",
    { area, offset, limit },
    false,
  );
  const albums = unique(
    rows(response, "albums", "data", "list")
      .map(normalizeAlbum)
      .filter((item): item is AlbumInfo => item !== null),
  );
  const total = Number(
    response.total ?? response.count ?? obj(response.data).total ?? 0,
  );
  return {
    albums,
    more:
      Boolean(response.more) || (total > 0 && offset + albums.length < total),
  };
}

export async function getNewestAlbums(): Promise<AlbumInfo[]> {
  const response = await request<Obj>("/album/newest", {}, false);
  return unique(
    rows(response, "albums", "data", "list")
      .map(normalizeAlbum)
      .filter((item): item is AlbumInfo => item !== null),
  );
}

export async function getTopAlbums(
  area: AlbumArea = "ALL",
  offset = 0,
  limit = 30,
): Promise<AlbumInfo[]> {
  const response = await request<Obj>(
    "/top/album",
    { area, offset, limit },
    false,
  );
  return unique(
    rows(response, "albums", "data", "list")
      .map(normalizeAlbum)
      .filter((item): item is AlbumInfo => item !== null),
  );
}

export async function getAlbumPrivileges(
  id: number,
): Promise<AlbumPrivilege[]> {
  if (!id) return [];
  const response = await cachedRequest<Obj>(
    "/album/privilege",
    { id },
    10 * 60 * 1000,
  );
  const value = obj(response.data ?? response.result ?? response);
  const rows = arr(value.data ?? value.list ?? response.data ?? response);
  // 官方音质等级序（与播放器 ALL_PLAYBACK_QUALITIES 一致），
  // 用于把 maxBrLevel 等级字符串展开为逐档支持布尔。
  const LEVEL_RANK: Record<string, number> = {
    standard: 0,
    higher: 1,
    exhigh: 2,
    lossless: 3,
    hires: 4,
    dolby: 5,
    jyeffect: 6,
    jymaster: 7,
    sky: 8,
    vivid: 9,
  };
  return rows
    .map((raw) => {
      const item = obj(raw);
      const songId = Number(item.id ?? item.songId ?? 0);
      const maxBitrate = Number(item.maxbr ?? item.maxBitrate ?? item.br ?? 0);
      // 权威信号：歌曲最高支持等级字符串（账号无关）。
      const maxLevel = String(item.maxBrLevel ?? item.playMaxBrLevel ?? "");
      const rank =
        maxLevel in LEVEL_RANK ? LEVEL_RANK[maxLevel] : -2;
      const atLeast = (level: string): boolean =>
        rank >= LEVEL_RANK[level] ||
        // 只有数值码率时的降级路径：999k 视为到无损，320k 到极高。
        (rank === -2 && maxBitrate >= 999000 && LEVEL_RANK[level] <= 3) ||
        (rank === -2 && maxBitrate >= 192000 && LEVEL_RANK[level] <= 2);
      // 权限位图（官方客户端同款位定义）：14 dolby / 16 jymaster /
      // 17 jyeffect / 18 sky / 21 vivid / 12 hires。
      const flag = Number(item.flag ?? 0);
      const bit = (n: number): boolean => ((flag >> n) & 1) === 1;
      return {
        songId,
        maxBitrate,
        maxLevel: maxLevel || undefined,
        standard:
          rank >= -1 ||
          maxBitrate > 0 ||
          Boolean(item.pl ?? item.standard),
        lossless: atLeast("lossless") || Number(item.pl ?? 0) >= 999000,
        highRes:
          atLeast("hires") ||
          bit(12) ||
          Boolean(item.hr ?? item.highRes ?? item.hires),
        dolby: bit(14) || Boolean(item.db ?? item.dolby),
        spatialAudio: Boolean(item.jm ?? item.spatialAudio ?? item.jyeffect),
        surroundEffect:
          atLeast("jyeffect") ||
          bit(17) ||
          Boolean(item.je ?? item.jyeffect ?? item.surround),
        immersive: atLeast("sky") || bit(18) || Boolean(item.sky),
        jymaster:
          atLeast("jymaster") ||
          bit(16) ||
          Boolean(item.jm ?? item.jymaster ?? item.master),
        vivid: atLeast("vivid") || bit(21) || Boolean(item.vv ?? item.vivid),
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
  const response = await request<Obj>(
    "/artist/list",
    { area, type, initial, offset, limit },
    false,
  );
  const artists = unique(
    rows(response, "artists", "data", "list")
      .map(normalizeArtist)
      .filter((item): item is ArtistInfo => item !== null),
  );
  const total = Number(
    response.total ?? response.count ?? obj(response.data).total ?? 0,
  );
  return {
    artists,
    more:
      Boolean(response.more) || (total > 0 && offset + artists.length < total),
  };
}

export async function getTopArtists(
  offset = 0,
  limit = 50,
): Promise<ArtistInfo[]> {
  const response = await request<Obj>("/top/artists", { offset, limit }, false);
  return unique(
    rows(response, "artists", "data", "list")
      .map(normalizeArtist)
      .filter((item): item is ArtistInfo => item !== null),
  );
}
