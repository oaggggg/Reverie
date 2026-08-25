import { normalizeSong, request } from "./client.ts";
import type {
  RecentAlbum,
  RecentCategory,
  RecentPlaylist,
  RecentRadio,
  SearchMediaInfo,
  Song,
} from "./types.ts";

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj =>
  value && typeof value === "object" ? (value as Obj) : {};
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

function listOf(response: Obj): unknown[] {
  const data = obj(response.data ?? response);
  return arr(data.list ?? data.records ?? response.list ?? response.data);
}

export async function getRecentSongs(limit = 100): Promise<Song[]> {
  const response = await request<Obj>("/record/recent/song", { limit }, false);
  return listOf(response)
    .map((raw) => normalizeSong(obj(raw).song ?? raw))
    .filter((song): song is Song => song !== null);
}

export async function getRecentListenSongs(limit = 100): Promise<Song[]> {
  const response = await request<Obj>("/recent/listen/list", { limit }, false);
  return listOf(response)
    .map((raw) => normalizeSong(obj(raw).song ?? obj(raw).resource ?? raw))
    .filter((song): song is Song => song !== null);
}

export async function getRecentAlbums(limit = 100): Promise<RecentAlbum[]> {
  const response = await request<Obj>("/record/recent/album", { limit }, false);
  return listOf(response)
    .map((raw) => {
      const value = obj(raw);
      const album = obj(value.album ?? value);
      return {
        id: Number(album.id ?? 0),
        name: String(album.name ?? "专辑"),
        coverUrl: String(album.picUrl ?? album.coverImgUrl ?? ""),
        artistName: String(obj(album.artist).name ?? ""),
        time: Number(value.playTime ?? value.time ?? 0),
      } satisfies RecentAlbum;
    })
    .filter((item) => item.id > 0);
}

export async function getRecentPlaylists(
  limit = 100,
): Promise<RecentPlaylist[]> {
  const response = await request<Obj>(
    "/record/recent/playlist",
    { limit },
    false,
  );
  return listOf(response)
    .map((raw) => {
      const value = obj(raw);
      const playlist = obj(value.playlist ?? value);
      const creator = obj(playlist.creator);
      return {
        id: Number(playlist.id ?? 0),
        name: String(playlist.name ?? "歌单"),
        coverUrl: String(playlist.coverImgUrl ?? ""),
        creatorName: String(creator.nickname ?? ""),
        time: Number(value.playTime ?? value.time ?? 0),
      } satisfies RecentPlaylist;
    })
    .filter((item) => item.id > 0);
}

export async function getRecentRadios(limit = 100): Promise<RecentRadio[]> {
  const response = await request<Obj>("/record/recent/dj", { limit }, false);
  return listOf(response)
    .map((raw) => {
      const value = obj(raw);
      const radio = obj(value.djRadio ?? value.radio ?? value);
      const dj = obj(radio.dj);
      return {
        id: Number(radio.id ?? 0),
        name: String(radio.name ?? "播客"),
        coverUrl: String(radio.picUrl ?? radio.coverUrl ?? ""),
        creatorName: String(dj.nickname ?? ""),
        time: Number(value.playTime ?? value.time ?? 0),
      } satisfies RecentRadio;
    })
    .filter((item) => item.id > 0);
}

function mediaList(response: Obj, kind: "mv" | "video"): SearchMediaInfo[] {
  return listOf(response)
    .map((raw) => {
      const value = obj(raw);
      const media = obj(value.resource ?? value.video ?? value.mv ?? value);
      return {
        id: String(media.id ?? media.vid ?? ""),
        name: String(media.name ?? media.title ?? "视频"),
        coverUrl: String(media.coverUrl ?? media.cover ?? media.imgurl ?? ""),
        creatorName: String(
          obj(media.creator).nickname ?? media.artistName ?? "",
        ),
        duration: Number(media.duration ?? media.durationms ?? 0),
        playCount: Number(media.playCount ?? 0),
        kind,
      } satisfies SearchMediaInfo;
    })
    .filter((item) => item.id);
}

export async function getRecentMedia(
  category: "videos" | "voices",
  limit = 100,
): Promise<SearchMediaInfo[]> {
  const route =
    category === "videos" ? "/record/recent/video" : "/record/recent/voice";
  return mediaList(await request<Obj>(route, { limit }, false), "video");
}

export async function getRecentCategory(category: RecentCategory) {
  if (category === "songs") return { songs: await getRecentSongs() };
  if (category === "listen")
    return { listenSongs: await getRecentListenSongs() };
  if (category === "albums") return { albums: await getRecentAlbums() };
  if (category === "playlists")
    return { playlists: await getRecentPlaylists() };
  if (category === "radios") return { radios: await getRecentRadios() };
  return {
    media: await getRecentMedia(category === "videos" ? "videos" : "voices"),
  };
}
