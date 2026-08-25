import { normalizeSong, request } from "./client.ts";
import type { SearchMediaInfo, Song } from "./types.ts";

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Obj)
    : {};
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

export interface ArtistIntroduction {
  briefDesc: string;
  introduction: Array<{ title: string; content: string }>;
}

export interface ArtistDynamic {
  followed: boolean;
  musicSize: number;
  albumSize: number;
  mvSize: number;
  fansCount: number;
}

export async function getArtistIntroduction(
  id: number,
): Promise<ArtistIntroduction> {
  const response = await request<Obj>("/artist/desc", { id }, false);
  const value = obj(response.data ?? response.result ?? response);
  const introduction = arr(value.introduction ?? value.intros ?? value.sections)
    .map((raw) => {
      const item = obj(raw);
      return {
        title: String(item.ti ?? item.title ?? "").trim(),
        content: String(item.txt ?? item.content ?? item.text ?? "").trim(),
      };
    })
    .filter((item) => item.title || item.content);
  return {
    briefDesc: String(
      value.briefDesc ?? value.briefDescription ?? value.desc ?? "",
    ),
    introduction,
  };
}

export async function getArtistDynamic(id: number): Promise<ArtistDynamic> {
  const response = await request<Obj>("/artist/detail/dynamic", { id }, false);
  const value = obj(response.data ?? response.result ?? response);
  return {
    followed: Boolean(value.followed ?? value.follow ?? value.isSub),
    musicSize: Number(value.musicSize ?? value.musicCount ?? 0),
    albumSize: Number(value.albumSize ?? value.albumCount ?? 0),
    mvSize: Number(value.mvSize ?? value.mvCount ?? 0),
    fansCount: Number(value.fansCount ?? value.followCount ?? 0),
  };
}

export async function getArtistTopSongs(id: number): Promise<Song[]> {
  const response = await request<Obj>("/artist/top/song", { id }, false);
  const value = obj(response.data ?? response.result ?? response);
  return arr(value.songs ?? value.list ?? response.songs ?? response.data)
    .map(normalizeSong)
    .filter((song): song is Song => song !== null);
}

export async function getArtistNewMvs(
  limit = 20,
  before?: number,
): Promise<SearchMediaInfo[]> {
  const response = await request<Obj>(
    "/artist/new/mv",
    { limit, before },
    false,
  );
  const value = obj(response.data ?? response.result ?? response);
  return arr(value.data ?? value.list ?? value.mvs ?? response.data ?? response)
    .map((raw) => {
      const item = obj(raw);
      const artist = obj(item.artist);
      return {
        id: String(item.id ?? item.mvId ?? item.vid ?? ""),
        name: String(item.name ?? item.title ?? "MV"),
        coverUrl: String(
          item.cover ?? item.coverUrl ?? item.imgurl ?? item.picUrl ?? "",
        ),
        creatorName: String(item.artistName ?? artist.name ?? ""),
        duration: Number(item.duration ?? item.durationms ?? 0),
        playCount: Number(item.playCount ?? item.playTime ?? 0),
        kind: "mv",
      } satisfies SearchMediaInfo;
    })
    .filter((item) => item.id);
}

export async function getArtistMvs(
  id: number,
  limit = 20,
  offset = 0,
): Promise<SearchMediaInfo[]> {
  if (!id) return [];
  const response = await request<Obj>(
    "/artist/mv",
    { id, limit, offset },
    false,
  );
  const value = obj(response.data ?? response.result ?? response);
  return arr(value.data ?? value.list ?? value.mvs ?? response.data ?? response)
    .map((raw) => {
      const item = obj(raw);
      const artist = obj(item.artist);
      return {
        id: String(item.id ?? item.mvId ?? item.vid ?? ""),
        name: String(item.name ?? item.title ?? "MV"),
        coverUrl: String(
          item.cover ?? item.coverUrl ?? item.imgurl ?? item.picUrl ?? "",
        ),
        creatorName: String(item.artistName ?? artist.name ?? ""),
        duration: Number(item.duration ?? item.durationms ?? 0),
        playCount: Number(item.playCount ?? item.playTime ?? 0),
        kind: "mv",
      } satisfies SearchMediaInfo;
    })
    .filter((item) => item.id);
}

export async function getArtistNewSongs(
  limit = 20,
  before?: number,
): Promise<Song[]> {
  const response = await request<Obj>(
    "/artist/new/song",
    { limit, before },
    false,
  );
  const value = obj(response.data ?? response.result ?? response);
  return arr(
    value.data ?? value.songs ?? value.list ?? response.data ?? response,
  )
    .map((raw) => normalizeSong(obj(raw).song ?? raw))
    .filter((song): song is Song => song !== null);
}

export async function getArtistSongs(
  id: number,
  order: "hot" | "time" = "hot",
  limit = 100,
  offset = 0,
): Promise<Song[]> {
  if (!id) return [];
  const response = await request<Obj>(
    "/artist/songs",
    { id, order, limit, offset },
    false,
  );
  const value = obj(response.data ?? response.result ?? response);
  return arr(
    value.songs ?? value.list ?? response.songs ?? response.data ?? response,
  )
    .map((raw) => normalizeSong(obj(raw).song ?? raw))
    .filter((song): song is Song => song !== null);
}
