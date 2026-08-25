import { request } from "./client.ts";
import type { SocialUser } from "./types.ts";

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj =>
  value && typeof value === "object" ? (value as Obj) : {};
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

export interface UserIdMatch {
  nickname: string;
  userId: number;
}

/** Resolve one or more NetEase nicknames to account ids. */
export async function getUserIds(
  nicknames: string | string[],
): Promise<UserIdMatch[]> {
  const names = (Array.isArray(nicknames) ? nicknames : [nicknames])
    .map((name) => name.trim())
    .filter(Boolean);
  if (!names.length) return [];
  const response = await request<Obj>(
    "/get/userids",
    { nicknames: names.join(",") },
    false,
  );
  const rows = response.data ?? response.result ?? response.ids ?? response;
  return arr(rows)
    .map((raw, index) => {
      const value = obj(raw);
      const userId = Number(value.userId ?? value.id ?? value.uid ?? raw ?? 0);
      return {
        nickname: String(value.nickname ?? value.name ?? names[index] ?? ""),
        userId,
      } satisfies UserIdMatch;
    })
    .filter((item) => item.userId > 0);
}

function normalizeUser(raw: unknown): SocialUser {
  const value = obj(raw);
  const profile = obj(value.profile ?? value.user);
  return {
    userId: Number(value.userId ?? value.id ?? profile.userId ?? 0),
    nickname: String(value.nickname ?? profile.nickname ?? "网易云用户"),
    avatarUrl: String(value.avatarUrl ?? profile.avatarUrl ?? ""),
    signature: String(value.signature ?? profile.signature ?? ""),
    followed: Boolean(value.followed ?? value.mutual ?? false),
    follows: Number(value.follows ?? profile.follows ?? 0),
    followeds: Number(value.followeds ?? profile.followeds ?? 0),
  };
}

/** Read accounts with similar listening preferences for a song. */
export async function getSimilarUsers(
  songId: number,
  limit = 50,
  offset = 0,
): Promise<SocialUser[]> {
  if (!songId) return [];
  const response = await request<Obj>(
    "/simi/user",
    { id: songId, limit, offset },
    false,
  );
  const value = obj(response.data ?? response.result ?? response);
  return arr(
    value.users ??
      value.list ??
      response.users ??
      response.list ??
      response.data,
  )
    .map(normalizeUser)
    .filter((user) => user.userId > 0);
}
