import { normalizeSong, request } from "./client.ts";
import type { RadioInfo, Song } from "./types";

type Obj = Record<string, unknown>;

const obj = (value: unknown): Obj =>
  value && typeof value === "object" ? (value as Obj) : {};
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

export interface ProfileDetail {
  userId: number;
  nickname: string;
  avatarUrl: string;
  backgroundUrl: string;
  signature: string;
  follows: number;
  followeds: number;
  playlistCount: number;
  eventCount: number;
  listenSongs: number;
  level: number;
  createTime: number;
}

export interface UserLevelInfo {
  level: number;
  progress: number;
  nowPlayCount: number;
  nextPlayCount: number;
  nowLoginCount: number;
  nextLoginCount: number;
}

export interface UserSubcount {
  artistCount: number;
  albumCount: number;
  mvCount: number;
  djRadioCount: number;
  createdPlaylistCount: number;
  subPlaylistCount: number;
}

export interface UserMedal {
  id: number;
  name: string;
  iconUrl: string;
  description: string;
  level: number;
  obtained: boolean;
}

export interface ListeningRecord {
  song: Song;
  playCount: number;
  score: number;
}

export interface ProfileCenterData {
  detail: ProfileDetail;
  level: UserLevelInfo;
  subcount: UserSubcount;
  records: ListeningRecord[];
}

function normalizeRecords(value: unknown): ListeningRecord[] {
  return arr(value)
    .map((raw) => {
      const record = obj(raw);
      const song = normalizeSong(record.song);
      return song
        ? {
            song,
            playCount: Number(record.playCount ?? 0),
            score: Number(record.score ?? 0),
          }
        : null;
    })
    .filter((record): record is ListeningRecord => record !== null);
}

export async function getListeningRecords(
  uid: number,
  period: "week" | "all",
): Promise<ListeningRecord[]> {
  const response = await request<Obj>("/user/record", {
    uid,
    type: period === "week" ? 1 : 0,
  });
  return normalizeRecords(
    period === "week" ? response.weekData : response.allData,
  );
}

export async function getProfileCenter(
  uid: number,
): Promise<ProfileCenterData> {
  // /user/detail 偶发失败不应让个人中心整页空白：降级为空档案继续返回，
  // 由调用方（profileStore）叠加本地缓存的基础身份信息。
  const [detailResponse, levelResponse, subcountResponse, records] =
    await Promise.all([
      request<Obj>("/user/detail", { uid }).catch(() => ({}) as Obj),
      request<Obj>("/user/level", {}, false).catch(() => ({}) as Obj),
      request<Obj>("/user/subcount", {}, false).catch(() => ({}) as Obj),
      getListeningRecords(uid, "week").catch(() => []),
    ]);
  const profile = obj(detailResponse.profile);
  const levelData = obj(levelResponse.data);
  return {
    detail: {
      userId: Number(profile.userId ?? uid),
      nickname: String(profile.nickname ?? "网易云用户"),
      avatarUrl: String(profile.avatarUrl ?? ""),
      backgroundUrl: String(profile.backgroundUrl ?? ""),
      signature: String(profile.signature ?? ""),
      follows: Number(profile.follows ?? 0),
      followeds: Number(profile.followeds ?? 0),
      playlistCount: Number(profile.playlistCount ?? 0),
      eventCount: Number(profile.eventCount ?? 0),
      listenSongs: Number(detailResponse.listenSongs ?? 0),
      level: Number(detailResponse.level ?? levelData.level ?? 0),
      createTime: Number(detailResponse.createTime ?? profile.createTime ?? 0),
    },
    level: {
      level: Number(levelData.level ?? detailResponse.level ?? 0),
      progress: Number(levelData.progress ?? 0),
      nowPlayCount: Number(levelData.nowPlayCount ?? 0),
      nextPlayCount: Number(levelData.nextPlayCount ?? 0),
      nowLoginCount: Number(levelData.nowLoginCount ?? 0),
      nextLoginCount: Number(levelData.nextLoginCount ?? 0),
    },
    subcount: {
      artistCount: Number(subcountResponse.artistCount ?? 0),
      albumCount: Number(subcountResponse.albumCount ?? 0),
      mvCount: Number(subcountResponse.mvCount ?? 0),
      djRadioCount: Number(subcountResponse.djRadioCount ?? 0),
      createdPlaylistCount: Number(
        subcountResponse.createdPlaylistCount ?? profile.playlistCount ?? 0,
      ),
      subPlaylistCount: Number(subcountResponse.subPlaylistCount ?? 0),
    },
    records,
  };
}

export async function getUserMedals(uid: number): Promise<UserMedal[]> {
  if (!uid) return [];
  const response = await request<Obj>("/user/medal", { uid }, false);
  const value = obj(response.data ?? response.result ?? response);
  return arr(value.medals ?? value.list ?? response.data ?? response)
    .map((raw) => {
      const item = obj(raw);
      return {
        id: Number(item.id ?? item.medalId ?? 0),
        name: String(item.name ?? item.medalName ?? "用户徽章"),
        iconUrl: String(item.iconUrl ?? item.picUrl ?? item.medalUrl ?? ""),
        description: String(item.description ?? item.desc ?? ""),
        level: Number(item.level ?? item.medalLevel ?? 0),
        obtained: Boolean(item.obtained ?? item.has ?? item.userMedal ?? true),
      } satisfies UserMedal;
    })
    .filter((item) => item.id > 0 && item.obtained);
}

export async function getUserCreatedRadios(uid: number): Promise<RadioInfo[]> {
  if (!uid) return [];
  const response = await request<Obj>("/user/audio", { uid }, false);
  const value = obj(response.data ?? response.result ?? response);
  return arr(
    value.djRadios ?? value.radios ?? value.list ?? response.data ?? response,
  )
    .map((raw) => {
      const item = obj(raw);
      const dj = obj(item.dj);
      return {
        id: Number(item.id ?? item.rid ?? 0),
        name: String(item.name ?? "我的电台"),
        picUrl: String(
          item.picUrl ?? item.intervenePicUrl ?? item.coverUrl ?? "",
        ),
        description: String(item.desc ?? item.description ?? ""),
        programCount: Number(item.programCount ?? 0),
        subscriberCount: Number(item.subCount ?? item.subscriberCount ?? 0),
        subscribed: Boolean(item.subscribed ?? false),
        category: String(item.category ?? item.categoryName ?? ""),
        djName: String(dj.nickname ?? item.djName ?? ""),
      } satisfies RadioInfo;
    })
    .filter((item) => item.id > 0);
}

export async function getUserDjPrograms(
  uid: number,
  limit = 30,
  offset = 0,
): Promise<Song[]> {
  if (!uid) return [];
  const response = await request<Obj>(
    "/user/dj",
    { uid, limit, offset },
    false,
  );
  const value = obj(response.data ?? response.result ?? response);
  return arr(value.programs ?? value.list ?? response.programs ?? response.data)
    .map((raw): Song | null => {
      const item = obj(raw);
      const source = obj(item.mainSong ?? item.song ?? item);
      const song = normalizeSong(source);
      if (!song) return null;
      const program: Song = {
        ...song,
        programId: Number(item.id ?? item.programId ?? 0) || undefined,
        name: String(item.name ?? song.name),
        album: String(item.radioName ?? obj(item.djRadio).name ?? song.album),
        picUrl: String(item.coverUrl ?? item.picUrl ?? song.picUrl),
      };
      return program;
    })
    .filter((song): song is Song => song !== null);
}
