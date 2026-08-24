import { normalizeSong, request } from "./client.ts";
import type { DownloadHistoryCategory, Song } from "./types.ts";

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj =>
  value && typeof value === "object" ? (value as Obj) : {};
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

function artistNamesFrom(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((artist) =>
        typeof artist === "string" ? artist : String(obj(artist).name ?? ""),
      )
      .filter(Boolean);
  }
  if (value && typeof value === "object") {
    const name = String(obj(value).name ?? "");
    return name ? [name] : [];
  }
  return String(value ?? "")
    .split(/\s*[/,&，]\s*/)
    .filter(Boolean);
}

function normalizeDownloadSong(raw: unknown): Song | null {
  const row = obj(raw);
  const source = obj(
    row.song ?? row.simpleSong ?? row.track ?? row.resource ?? row.songInfo ?? raw,
  );
  const flatArtist =
    source.artistName ?? source.artist ?? source.singerName ?? row.artistName;
  const flatArtists = artistNamesFrom(flatArtist);
  const flatAlbum = String(source.albumName ?? row.albumName ?? "");
  const normalized = normalizeSong(source);
  if (normalized) {
    return {
      ...normalized,
      artists:
        normalized.artists === "未知歌手" && flatArtists.length
          ? flatArtists.join(" / ")
          : normalized.artists,
      artistNames:
        normalized.artistNames.length > 0
          ? normalized.artistNames
          : flatArtists,
      album:
        normalized.album === "未知专辑" && flatAlbum
          ? flatAlbum
          : normalized.album,
    };
  }

  const id = Number(source.id ?? source.songId ?? row.songId ?? row.resourceId);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const albumValue = obj(source.album ?? source.al);
  return {
    id,
    name: String(source.name ?? source.songName ?? row.songName ?? "未知歌曲"),
    artists: flatArtists.join(" / ") || "未知歌手",
    artistNames: flatArtists,
    artistIds: [],
    album: String(albumValue.name || flatAlbum || "未知专辑"),
    albumId: Number(albumValue.id ?? source.albumId ?? row.albumId ?? 0),
    picUrl: String(
      albumValue.picUrl ??
        source.picUrl ??
        source.coverUrl ??
        row.coverUrl ??
        "",
    ),
    duration: Number(source.dt ?? source.duration ?? row.duration ?? 0),
    fee: Number(source.fee ?? row.fee ?? 0),
  };
}

export async function getDownloadHistory(
  category: DownloadHistoryCategory,
  limit = 30,
  offset = 0,
): Promise<Song[]> {
  const route =
    category === "all"
      ? "/song/downlist"
      : category === "month"
        ? "/song/monthdownlist"
        : category === "purchased"
          ? "/song/purchased"
          : "/song/singledownlist";
  const response = await request<Obj>(route, { limit, offset }, false);
  const data = obj(response.data ?? response);
  return arr(
    data.info ??
      data.list ??
      data.songs ??
      response.info ??
      response.songs ??
      response.data,
  )
    .map(normalizeDownloadSong)
    .filter((song): song is Song => song !== null);
}
