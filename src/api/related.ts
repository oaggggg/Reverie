import { cachedRequest, normalizeSong, request } from "./client.ts";
import type {
  ArtistInfo,
  PlaylistInfo,
  SearchMediaInfo,
  Song,
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
  return [];
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
    subscribed: Boolean(value.subscribed ?? value.subscribedCount),
    privacy: Number(value.privacy ?? 0),
    tags: arr(value.tags).map(String).filter(Boolean),
  };
}

function normalizeArtist(raw: unknown): ArtistInfo | null {
  const value = obj(raw);
  const id = Number(value.id ?? value.artistId ?? 0);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return {
    id,
    name: String(value.name ?? "未知歌手"),
    picUrl: String(value.picUrl ?? value.img1v1Url ?? value.picUrl120 ?? ""),
    alias: arr(value.alias).map(String).filter(Boolean),
    briefDesc: String(value.briefDesc ?? value.desc ?? ""),
    followed: Boolean(value.followed ?? value.follow),
    musicSize: Number(value.musicSize ?? 0),
    albumSize: Number(value.albumSize ?? 0),
  };
}

function normalizeMedia(raw: unknown): SearchMediaInfo | null {
  const value = obj(raw);
  const id = String(value.id ?? value.vid ?? "");
  if (!id) return null;
  return {
    id,
    name: String(value.name ?? value.title ?? "视频"),
    coverUrl: String(value.coverUrl ?? value.cover ?? value.imgurl ?? ""),
    creatorName: String(value.creatorName ?? value.artistName ?? obj(value.creator).nickname ?? ""),
    duration: Number(value.duration ?? value.durationms ?? 0),
    playCount: Number(value.playCount ?? 0),
    kind: "video",
  };
}

function uniqueById<T extends { id: number | string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = String(item.id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function getRelatedPlaylists(id: number): Promise<PlaylistInfo[]> {
  const [related, similar, detailRecommendations] = await Promise.all([
    cachedRequest<Obj>("/related/playlist", { id }, 10 * 60 * 1000).catch(() => ({}) as Obj),
    cachedRequest<Obj>("/simi/playlist", { id }, 10 * 60 * 1000).catch(() => ({}) as Obj),
    cachedRequest<Obj>("/playlist/detail/rcmd/get", { id }, 10 * 60 * 1000).catch(() => ({}) as Obj),
  ]);
  return uniqueById(
    [...list(related, "playlists"), ...list(similar, "playlists"), ...list(detailRecommendations, "playlists", "list")]
      .map(normalizePlaylist)
      .filter((item): item is PlaylistInfo => item !== null),
  );
}

export async function getSimilarArtists(id: number): Promise<ArtistInfo[]> {
  const response = await request<Obj>("/simi/artist", { id }, false);
  return uniqueById(
    list(response, "artists")
      .map(normalizeArtist)
      .filter((item): item is ArtistInfo => item !== null),
  );
}

export async function getSimilarSongs(id: number): Promise<Song[]> {
  const response = await request<Obj>("/simi/song", { id }, false);
  return uniqueById(
    list(response, "songs")
      .map(normalizeSong)
      .filter((item): item is Song => item !== null),
  );
}

export async function getRelatedVideos(id: number): Promise<SearchMediaInfo[]> {
  const response = await request<Obj>("/related/allvideo", { id }, false);
  return uniqueById(
    list(response, "data", "videos", "resources")
      .map(normalizeMedia)
      .filter((item): item is SearchMediaInfo => item !== null),
  );
}
