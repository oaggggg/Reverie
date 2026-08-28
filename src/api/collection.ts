import { cachedRequest, invalidateResponseCache, request } from "./client.ts";
import { getSubscribedAlbums } from "./extended.ts";
import type {
  ArtistInfo,
  CollectionCategory,
  CollectionResultPage,
  RadioInfo,
  SearchMediaInfo,
} from "./types.ts";

type Obj = Record<string, unknown>;

const obj = (value: unknown): Obj =>
  value && typeof value === "object" ? (value as Obj) : {};
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** 收藏列表短缓存：重进收藏页不重拉（分页参数在缓存键内）。 */
const COLLECTION_TTL = 2 * 60 * 1000;

function normalizeArtist(raw: unknown): ArtistInfo {
  const value = obj(raw);
  return {
    id: Number(value.id ?? 0),
    name: String(value.name ?? "未知歌手"),
    picUrl: String(value.picUrl ?? value.img1v1Url ?? value.cover ?? ""),
    alias: arr(value.alias).map(String),
    briefDesc: String(value.briefDesc ?? ""),
    followed: true,
    musicSize: Number(value.musicSize ?? 0),
    albumSize: Number(value.albumSize ?? 0),
  };
}

function normalizeMedia(raw: unknown): SearchMediaInfo {
  const value = obj(raw);
  const artist = obj(value.artist);
  const artists = arr(value.artists).map(obj);
  const creator = obj(value.creator);
  const creators = arr(value.creator).map(obj);
  const creatorName =
    String(
      value.artistName ?? artist.name ?? creator.nickname ?? creator.name ?? "",
    ) ||
    creators
      .map((item) => String(item.userName ?? item.nickname ?? item.name ?? ""))
      .filter(Boolean)
      .join(" / ") ||
    artists
      .map((item) => String(item.name ?? ""))
      .filter(Boolean)
      .join(" / ");
  return {
    id: String(value.id ?? value.mvid ?? value.vid ?? ""),
    name: String(value.name ?? value.title ?? "未命名 MV"),
    coverUrl: String(
      value.cover ?? value.coverUrl ?? value.imgurl ?? value.picUrl ?? "",
    ),
    creatorName,
    duration: Number(value.duration ?? value.durationms ?? 0),
    playCount: Number(value.playCount ?? value.playTime ?? 0),
    kind: "mv",
  };
}

function normalizeRadio(raw: unknown): RadioInfo {
  const value = obj(raw);
  const dj = obj(value.dj);
  return {
    id: Number(value.id ?? 0),
    name: String(value.name ?? "播客"),
    picUrl: String(value.picUrl ?? value.intervenePicUrl ?? ""),
    description: String(value.desc ?? value.description ?? ""),
    programCount: Number(value.programCount ?? 0),
    subscriberCount: Number(value.subCount ?? value.subscriberCount ?? 0),
    subscribed: true,
    category: String(value.category ?? value.categoryName ?? ""),
    djName: String(dj.nickname ?? ""),
  };
}

export async function getCollection(
  category: CollectionCategory,
  limit = 30,
  offset = 0,
): Promise<CollectionResultPage> {
  if (category === "albums") {
    const result = await getSubscribedAlbums(limit, offset);
    return {
      albums: result.albums,
      artists: [],
      media: [],
      radios: [],
      total: result.total,
      hasMore: result.hasMore,
    };
  }
  if (category === "artists") {
    const response = await cachedRequest<Obj>("/artist/sublist", { limit, offset }, COLLECTION_TTL);
    const artists = arr(response.data)
      .map(normalizeArtist)
      .filter((item) => item.id > 0);
    const total = Number(response.count ?? artists.length);
    return {
      albums: [],
      artists,
      media: [],
      radios: [],
      total,
      hasMore: Boolean(response.hasMore) || offset + artists.length < total,
    };
  }
  if (category === "mvs") {
    const response = await cachedRequest<Obj>("/mv/sublist", { limit, offset }, COLLECTION_TTL);
    const media = arr(response.data)
      .map(normalizeMedia)
      .filter((item) => item.id);
    const total = Number(response.count ?? media.length);
    return {
      albums: [],
      artists: [],
      media,
      radios: [],
      total,
      hasMore: Boolean(response.hasMore) || offset + media.length < total,
    };
  }
  const response = await cachedRequest<Obj>("/dj/sublist", { limit, offset }, COLLECTION_TTL);
  const radios = arr(response.djRadios)
    .map(normalizeRadio)
    .filter((item) => item.id > 0);
  const total = Number(response.count ?? radios.length);
  return {
    albums: [],
    artists: [],
    media: [],
    radios,
    total,
    hasMore: Boolean(response.hasMore) || offset + radios.length < total,
  };
}

export async function subscribeCollection(
  category: CollectionCategory,
  id: number,
  subscribe: boolean,
): Promise<void> {
  if (category === "albums") {
    await request("/album/sub", { id, t: subscribe ? 1 : 0 }, false);
  } else if (category === "artists") {
    await request("/artist/sub", { id, t: subscribe ? 1 : 0 }, false);
  } else if (category === "mvs") {
    await request("/mv/sub", { mvid: id, t: subscribe ? 1 : 0 }, false);
  } else {
    await request("/dj/sub", { rid: id, t: subscribe ? 1 : 0 }, false);
  }
  // 收藏状态变了，立刻失效对应列表缓存，下次读取不再等 TTL。
  invalidateResponseCache(["/artist/sublist", "/mv/sublist", "/dj/sublist"]);
}
