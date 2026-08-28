import {
  cachedRequest,
  getUserPlaylists,
  invalidateResponseCache,
  normalizeSong,
  request,
} from "./client.ts";
import type {
  AlbumInfo,
  ArtistInfo,
  CommentInfo,
  PlaylistInfo,
  RadioInfo,
  SocialEvent,
  SocialUser,
  Song,
  SearchMediaInfo,
} from "./types.ts";

type Obj = Record<string, unknown>;

const obj = (value: unknown): Obj =>
  value && typeof value === "object" ? (value as Obj) : {};
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** 社交读接口缓存：重进社交页/关注列表不再全量重拉。 */
const SOCIAL_TTL = 2 * 60 * 1000;
const EVENT_TTL = 60 * 1000;

function normalizeArtist(raw: unknown): ArtistInfo {
  const a = obj(raw);
  return {
    id: Number(a.id ?? 0),
    name: String(a.name ?? "未知歌手"),
    picUrl: String(a.cover ?? a.picUrl ?? a.img1v1Url ?? ""),
    alias: arr(a.alias).map(String),
    briefDesc: String(a.briefDesc ?? ""),
    followed: Boolean(a.followed ?? a.follow),
    musicSize: Number(a.musicSize ?? 0),
    albumSize: Number(a.albumSize ?? 0),
  };
}

function normalizeAlbum(raw: unknown, subscribed = false): AlbumInfo {
  const a = obj(raw);
  const artists = arr(a.artists).map(obj);
  const artist = obj(a.artist);
  const artistList = artists.length ? artists : artist.id ? [artist] : [];
  return {
    id: Number(a.id ?? 0),
    name: String(a.name ?? "未知专辑"),
    picUrl: String(a.picUrl ?? a.blurPicUrl ?? ""),
    artistNames: artistList
      .map((x) => String(x.name ?? ""))
      .filter(Boolean)
      .join(" / "),
    artistIds: artistList.map((x) => Number(x.id ?? 0)).filter((id) => id > 0),
    description: String(a.description ?? a.briefDesc ?? ""),
    publishTime: Number(a.publishTime ?? 0),
    size: Number(a.size ?? a.trackCount ?? 0),
    subscribed: Boolean(a.subscribed ?? a.isSub ?? subscribed),
  };
}

function normalizePlaylist(raw: unknown): PlaylistInfo {
  const p = obj(raw);
  const creator = obj(p.creator);
  return {
    id: Number(p.id ?? 0),
    name: String(p.name ?? "歌单"),
    coverImgUrl: String(p.coverImgUrl ?? ""),
    trackCount: Number(p.trackCount ?? 0),
    description: String(p.description ?? ""),
    creatorId: Number(creator.userId ?? 0),
    creatorName: String(creator.nickname ?? ""),
    subscribed: Boolean(p.subscribed),
    privacy: Number(p.privacy ?? 0),
  };
}

function normalizeComment(raw: unknown): CommentInfo {
  const c = obj(raw);
  const user = obj(c.user);
  const replied = obj(arr(c.beReplied)[0]);
  const repliedUser = obj(replied.user);
  return {
    id: Number(c.commentId ?? c.id ?? 0),
    content: String(c.content ?? ""),
    time: Number(c.time ?? 0),
    liked: Boolean(c.liked),
    likedCount: Number(c.likedCount ?? 0),
    replyCount: Number(c.replyCount ?? obj(c.showFloorComment).replyCount ?? 0),
    owner: Boolean(c.owner),
    userId: Number(user.userId ?? 0),
    nickname: String(user.nickname ?? "网易云用户"),
    avatarUrl: String(user.avatarUrl ?? ""),
    repliedTo: replied.content
      ? {
          userId: Number(repliedUser.userId ?? 0),
          nickname: String(repliedUser.nickname ?? "网易云用户"),
          content: String(replied.content ?? ""),
        }
      : undefined,
  };
}

function normalizeRadio(raw: unknown): RadioInfo {
  const r = obj(raw);
  const radio = obj(r.radio);
  const value = radio.id ? radio : r;
  const dj = obj(value.dj);
  return {
    id: Number(value.id ?? 0),
    name: String(value.name ?? "电台"),
    picUrl: String(value.picUrl ?? value.intervenePicUrl ?? ""),
    description: String(value.desc ?? value.description ?? ""),
    programCount: Number(value.programCount ?? 0),
    subscriberCount: Number(value.subCount ?? value.subscriberCount ?? 0),
    subscribed: Boolean(value.subed ?? value.subscribed),
    category: String(value.category ?? value.categoryName ?? ""),
    djName: String(dj.nickname ?? ""),
  };
}

function normalizeUser(raw: unknown): SocialUser {
  const value = obj(raw);
  const u = obj(value.user ?? value.profile ?? value);
  return {
    userId: Number(u.userId ?? u.id ?? value.userId ?? value.id ?? 0),
    nickname: String(u.nickname ?? value.nickname ?? "网易云用户"),
    avatarUrl: String(u.avatarUrl ?? value.avatarUrl ?? ""),
    signature: String(u.signature ?? value.signature ?? ""),
    followed: Boolean(u.followed ?? value.followed ?? u.mutual ?? value.mutual),
    follows: Number(u.follows ?? value.follows ?? 0),
    followeds: Number(u.followeds ?? value.followeds ?? 0),
  };
}

function parseEventResource(rawJson: unknown): {
  text: string;
  resourceTitle?: string;
  resourceType?: SocialEvent["resourceType"];
  resourceId?: number;
} {
  let data: Obj = {};
  try {
    data =
      typeof rawJson === "string" ? obj(JSON.parse(rawJson)) : obj(rawJson);
  } catch {
    data = {};
  }
  const candidates: Array<[string, SocialEvent["resourceType"]]> = [
    ["song", "song"],
    ["album", "album"],
    ["playlist", "playlist"],
    ["program", "other"],
    ["resource", "other"],
  ];
  for (const [key, type] of candidates) {
    const value = obj(data[key]);
    if (value.id) {
      return {
        text: String(data.msg ?? data.message ?? ""),
        resourceTitle: String(value.name ?? value.title ?? ""),
        resourceType: type,
        resourceId: Number(value.id),
      };
    }
  }
  return { text: String(data.msg ?? data.message ?? "") };
}

export async function getAlbum(
  id: number,
): Promise<{ album: AlbumInfo; songs: Song[] }> {
  const [content, dynamic] = await Promise.all([
    request<Obj>("/album", { id }),
    request<Obj>("/album/detail/dynamic", { id }).catch(() => ({}) as Obj),
  ]);
  const subscribed = Boolean(dynamic.isSub ?? obj(dynamic.data).isSub);
  return {
    album: normalizeAlbum(content.album, subscribed),
    songs: arr(content.songs)
      .map(normalizeSong)
      .filter((song): song is Song => song !== null),
  };
}

export async function subscribeAlbum(
  id: number,
  subscribe: boolean,
): Promise<void> {
  await request("/album/sub", { id, t: subscribe ? 1 : 0 }, false);
  invalidateResponseCache(["/album"]);
}

export async function getSubscribedAlbums(
  limit = 30,
  offset = 0,
): Promise<{ albums: AlbumInfo[]; total: number; hasMore: boolean }> {
  const res = await request<Obj>("/album/sublist", { limit, offset }, false);
  const albums = arr(res.data)
    .map((item) => normalizeAlbum(item, true))
    .filter((album) => album.id > 0);
  const total = Number(res.count ?? res.total ?? albums.length);
  return {
    albums,
    total,
    hasMore: Boolean(res.hasMore) || offset + albums.length < total,
  };
}

export async function getArtist(id: number): Promise<{
  artist: ArtistInfo;
  songs: Song[];
  albums: AlbumInfo[];
  videos: SearchMediaInfo[];
}> {
  const [detail, content, albums, videos] = await Promise.all([
    request<Obj>("/artist/detail", { id }).catch(() => ({}) as Obj),
    request<Obj>("/artists", { id }),
    request<Obj>("/artist/album", { id, limit: 50 }),
    request<Obj>("/artist/video", { id, size: 20, cursor: 0, order: 0 }).catch(
      () => ({}) as Obj,
    ),
  ]);
  const detailArtist = obj(obj(detail.data).artist);
  const contentArtist = obj(content.artist);
  return {
    artist: normalizeArtist(detailArtist.id ? detailArtist : contentArtist),
    songs: arr(content.hotSongs)
      .map(normalizeSong)
      .filter((song): song is Song => song !== null),
    albums: arr(albums.hotAlbums).map((item) => normalizeAlbum(item)),
    videos: arr(
      obj(videos.data ?? videos.result ?? videos).videos ??
        obj(videos.data ?? videos.result ?? videos).list ??
        obj(videos.data ?? videos.result ?? videos).data ??
        videos.data ??
        videos.videos,
    )
      .map((item) => {
        const value = obj(item);
        return {
          id: String(value.id ?? value.vid ?? ""),
          name: String(value.name ?? value.title ?? "视频"),
          coverUrl: String(value.cover ?? value.coverUrl ?? value.imgurl ?? ""),
          creatorName: String(value.artistName ?? ""),
          duration: Number(value.duration ?? value.durationms ?? 0),
          playCount: Number(value.playCount ?? 0),
          kind: "video",
        } satisfies SearchMediaInfo;
      })
      .filter((item) => item.id),
  };
}

export async function subscribeArtist(
  id: number,
  subscribe: boolean,
): Promise<void> {
  await request("/artist/sub", { id, t: subscribe ? 1 : 0 }, false);
  invalidateResponseCache(["/artist/detail", "/artists", "/artist/sublist"]);
}

export async function getSongComments(
  id: number,
  pageNo = 1,
  sortType: 2 | 3 = 2,
): Promise<{ comments: CommentInfo[]; total: number; hasMore: boolean }> {
  const res = await request<Obj>(
    "/comment/new",
    { id, type: 0, pageNo, pageSize: 30, sortType },
    true,
  );
  const data = obj(res.data);
  return {
    comments: arr(data.comments).map(normalizeComment),
    total: Number(data.totalCount ?? data.total ?? 0),
    hasMore: Boolean(data.hasMore),
  };
}

export async function sendSongComment(
  id: number,
  content: string,
): Promise<void> {
  await request("/comment", { t: 1, type: 0, id, content }, false);
}

export async function deleteSongComment(
  id: number,
  commentId: number,
): Promise<void> {
  await request("/comment", { t: 0, type: 0, id, commentId }, false);
}

export async function likeSongComment(
  id: number,
  commentId: number,
  like: boolean,
): Promise<void> {
  await request(
    "/comment/like",
    { id, cid: commentId, type: 0, t: like ? 1 : 0 },
    false,
  );
}

export async function createPlaylist(
  name: string,
  privacy = 0,
): Promise<PlaylistInfo> {
  const res = await request<Obj>("/playlist/create", { name, privacy }, false);
  invalidateResponseCache(["/user/playlist", "/top/playlist"]);
  return normalizePlaylist(res.playlist);
}

export async function updatePlaylist(
  id: number,
  name: string,
  description: string,
): Promise<void> {
  await Promise.all([
    request("/playlist/name/update", { id, name }, false),
    request("/playlist/desc/update", { id, desc: description }, false),
  ]);
}

/** Update playlist name, description and tags through the upstream batch route. */
export async function updatePlaylistBatch(
  id: number,
  name: string,
  description: string,
  tags = "",
): Promise<void> {
  if (!id) return;
  await request(
    "/playlist/update",
    { id, name, desc: description, tags },
    false,
  );
  invalidateResponseCache(["/playlist/detail", "/user/playlist"]);
}

/** Publish a private playlist. The upstream endpoint only supports privacy=0. */
export async function publishPlaylist(id: number): Promise<void> {
  if (!id) return;
  await request("/playlist/privacy", { id, privacy: 0 }, false);
  invalidateResponseCache(["/playlist/detail", "/user/playlist"]);
}

export async function deletePlaylist(id: number): Promise<void> {
  await request("/playlist/delete", { id }, false);
  invalidateResponseCache([
    "/playlist/detail",
    "/user/playlist",
    "/top/playlist",
  ]);
}

export async function subscribePlaylist(
  id: number,
  subscribe: boolean,
): Promise<void> {
  await request("/playlist/subscribe", { id, t: subscribe ? 1 : 0 }, false);
  invalidateResponseCache(["/playlist/detail", "/user/playlist"]);
}

export async function getPersonalFm(): Promise<Song[]> {
  const res = await request<Obj>("/personal_fm", {}, true);
  return arr(res.data)
    .map(normalizeSong)
    .filter((song): song is Song => song !== null);
}

export async function getRadioHome(): Promise<{
  recommended: RadioInfo[];
  subscribed: RadioInfo[];
}> {
  const [recommended, personalized, subscribed] = await Promise.all([
    request<Obj>("/dj/recommend", {}, true).catch(() => ({}) as Obj),
    request<Obj>("/dj/personalize/recommend", { limit: 18 }, true).catch(
      () => ({}) as Obj,
    ),
    request<Obj>("/dj/sublist", { limit: 100 }, true).catch(() => ({}) as Obj),
  ]);
  const merged = [...arr(recommended.djRadios), ...arr(personalized.data)];
  const seen = new Set<number>();
  const unique = merged.map(normalizeRadio).filter((radio) => {
    if (!radio.id || seen.has(radio.id)) return false;
    seen.add(radio.id);
    return true;
  });
  return {
    recommended: unique,
    subscribed: arr(subscribed.djRadios).map(normalizeRadio),
  };
}

export async function getRadioDetail(id: number): Promise<{
  radio: RadioInfo;
  programs: Song[];
}> {
  const [detail, programs] = await Promise.all([
    request<Obj>("/dj/detail", { rid: id }, true),
    request<Obj>("/dj/program", { rid: id, limit: 100 }, true),
  ]);
  const radio = normalizeRadio(detail.data ?? detail.djRadio);
  const songs = arr(programs.programs)
    .map((raw) => {
      const program = obj(raw);
      const song = normalizeSong(program.mainSong);
      if (!song) return null;
      return {
        ...song,
        ...(Number(program.id ?? 0) > 0
          ? { programId: Number(program.id) }
          : {}),
        name: String(program.name ?? song.name),
        picUrl: String(program.coverUrl ?? radio.picUrl ?? song.picUrl),
        album: radio.name,
      };
    })
    .filter((song): song is Song => song !== null);
  return { radio, programs: songs };
}

export async function subscribeRadio(
  id: number,
  subscribe: boolean,
): Promise<void> {
  await request("/dj/sub", { rid: id, t: subscribe ? 1 : 0 }, false);
  invalidateResponseCache(["/dj/sublist", "/dj/detail", "/dj/recommend"]);
}

export async function getFollows(uid: number): Promise<SocialUser[]> {
  const res = await cachedRequest<Obj>(
    "/user/follows",
    { uid, limit: 100 },
    SOCIAL_TTL,
  );
  const data = obj(res.data ?? res.result);
  const rows =
    res.follow ??
    res.users ??
    res.list ??
    data.follow ??
    data.users ??
    data.list;
  return arr(rows)
    .map(normalizeUser)
    .filter((user) => user.userId > 0);
}

export async function getFollowers(uid: number): Promise<SocialUser[]> {
  const res = await cachedRequest<Obj>(
    "/user/followeds",
    { uid, limit: 100 },
    SOCIAL_TTL,
  );
  const data = obj(res.data ?? res.result);
  const rows =
    res.followeds ??
    res.users ??
    res.list ??
    data.followeds ??
    data.users ??
    data.list;
  return arr(rows)
    .map(normalizeUser)
    .filter((user) => user.userId > 0);
}

export type FollowScene = 0 | 1 | 2;

export interface MixedFollowResult {
  users: SocialUser[];
  cursor: number;
  more: boolean;
}

/** Read the current account's mixed follow list (users and/or artists). */
export async function getMixedFollows(
  scene: FollowScene = 0,
  size = 100,
  cursor = 0,
): Promise<MixedFollowResult> {
  const res = await cachedRequest<Obj>(
    "/user/follow/mixed",
    { scene, size, cursor },
    SOCIAL_TTL,
  );
  const data = obj(res.data ?? res.result);
  const rows =
    res.follow ??
    res.users ??
    res.list ??
    data.follow ??
    data.users ??
    data.list ??
    data.records ??
    [];
  return {
    users: arr(rows)
      .map(normalizeUser)
      .filter((user) => user.userId > 0),
    cursor: Number(res.cursor ?? data.cursor ?? data.nextCursor ?? cursor),
    more: Boolean(res.more ?? data.more),
  };
}

/** Check whether the signed-in account mutually follows a user. */
export async function getMutualFollow(uid: number): Promise<boolean> {
  if (!uid) return false;
  const res = await request<Obj>("/user/mutualfollow/get", { uid }, true);
  const data = obj(res.data ?? res.result);
  return Boolean(res.mutual ?? res.isMutual ?? data.mutual ?? data.isMutual);
}

export async function followUser(id: number, follow: boolean): Promise<void> {
  await request("/follow", { id, t: follow ? 1 : 0 }, false);
  // 关注关系变化，立即失效三类关注列表缓存。
  invalidateResponseCache([
    "/user/follows",
    "/user/followeds",
    "/user/follow/mixed",
  ]);
}

export async function likeEvent(
  eventId: number,
  threadId: string,
  like: boolean,
): Promise<void> {
  await request(
    "/resource/like",
    { type: 6, id: eventId, threadId, t: like ? 1 : 0 },
    false,
    { method: "POST" },
  );
}

export async function forwardEvent(
  eventId: number,
  userId: number,
  forwards = "",
): Promise<void> {
  await request(
    "/event/forward",
    { evId: eventId, uid: userId, forwards },
    false,
    { method: "POST" },
  );
}

export async function deleteEvent(eventId: number): Promise<void> {
  if (!eventId) return;
  await request("/event/del", { evId: eventId }, false, { method: "POST" });
  invalidateResponseCache(["/event", "/user/event"]);
}

export async function getEvents(): Promise<SocialEvent[]> {
  const res = await cachedRequest<Obj>(
    "/event",
    { pagesize: 40, lasttime: -1 },
    EVENT_TTL,
  );
  return arr(res.event ?? res.events ?? res.data).map(normalizeSocialEvent);
}

function normalizeSocialEvent(raw: unknown): SocialEvent {
  const event = obj(raw);
  const info = obj(event.info);
  const resource = parseEventResource(event.json);
  return {
    id: Number(event.id ?? event.eventId ?? 0),
    type: Number(event.type ?? 0),
    time: Number(event.eventTime ?? event.showTime ?? event.time ?? 0),
    user: normalizeUser(event.user ?? event.profile),
    commentCount: Number(info.commentCount ?? event.commentCount ?? 0),
    forwardCount: Number(event.forwardCount ?? 0),
    likedCount: Number(info.likedCount ?? event.likedCount ?? 0),
    liked: Boolean(info.liked ?? event.liked),
    threadId: String(event.threadId ?? info.threadId ?? "") || undefined,
    ...resource,
  };
}

/** Load one user's public activity feed. */
export async function getUserEvents(
  uid: number,
  lasttime = -1,
  limit = 30,
): Promise<SocialEvent[]> {
  if (!uid) return [];
  const res = await cachedRequest<Obj>(
    "/user/event",
    { uid, lasttime, limit },
    EVENT_TTL,
  );
  return arr(res.events ?? res.event ?? res.data).map(normalizeSocialEvent);
}

export async function getUserCreatedPlaylists(
  uid: number,
): Promise<PlaylistInfo[]> {
  if (!uid) return [];
  // 网易云没有独立的「我创建」接口（/user/playlist/create 不存在，
  // 请求必然失败导致页面一直显示登录提示）。复用已验证的
  // /user/playlist 全量分页拉取，再按创建者拆分。
  const all = await getUserPlaylists(uid);
  return all.filter((playlist) => playlist.creatorId === uid);
}

export async function getUserCollectedPlaylists(
  uid: number,
): Promise<PlaylistInfo[]> {
  if (!uid) return [];
  const all = await getUserPlaylists(uid);
  return all.filter((playlist) => playlist.creatorId !== uid);
}

export async function getUserSocialStatus(uid: number): Promise<string> {
  if (!uid) return "";
  const response = await request<Obj>("/user/social/status", { uid }, false);
  const value = obj(response.data ?? response.result ?? response);
  return String(
    value.statusName ?? value.name ?? value.status ?? value.content ?? "",
  );
}

export async function getSocialStatusRecommendations(): Promise<string[]> {
  const response = await request<Obj>("/user/social/status/rcmd", {}, false);
  const value = obj(response.data ?? response.result ?? response);
  return arr(value.list ?? value.statuses ?? response.data ?? response)
    .map((raw) => String(obj(raw).name ?? obj(raw).content ?? raw))
    .filter(Boolean);
}

export async function getSupportedSocialStatuses(): Promise<string[]> {
  const response = await request<Obj>("/user/social/status/support", {}, false);
  const value = obj(response.data ?? response.result ?? response);
  return arr(value.list ?? value.statuses ?? response.data ?? response)
    .map((raw) => String(obj(raw).name ?? obj(raw).content ?? raw))
    .filter(Boolean);
}
