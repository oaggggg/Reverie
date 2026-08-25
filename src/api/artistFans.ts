import { request } from "./client.ts";
import type { ArtistFan } from "./types.ts";

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Obj)
    : {};
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

function normalizeFan(raw: unknown): ArtistFan | null {
  const value = obj(raw);
  const userId = Number(value.userId ?? value.id ?? value.uid ?? 0);
  if (!userId) return null;
  return {
    userId,
    nickname: String(value.nickname ?? value.name ?? "网易云用户"),
    avatarUrl: String(value.avatarUrl ?? value.avatar ?? value.img1v1Url ?? ""),
    followed: Boolean(value.followed ?? value.follow),
    signature: String(value.signature ?? value.description ?? ""),
  };
}

export async function getArtistFans(
  artistId: number,
  limit = 12,
  offset = 0,
): Promise<{ fans: ArtistFan[]; total: number; hasMore: boolean }> {
  const [listResponse, countResponse] = await Promise.all([
    request<Obj>("/artist/fans", { id: artistId, limit, offset }, false),
    request<Obj>("/artist/follow/count", { id: artistId }, false).catch(
      () => ({}) as Obj,
    ),
  ]);
  const value = obj(listResponse.data ?? listResponse.result ?? listResponse);
  const fans = arr(
    value.list ?? value.fans ?? listResponse.fans ?? listResponse.data,
  )
    .map(normalizeFan)
    .filter((item): item is ArtistFan => item !== null);
  const countValue = obj(
    countResponse.data ?? countResponse.result ?? countResponse,
  );
  const total = Number(
    countValue.count ??
      countValue.fansCount ??
      value.total ??
      value.count ??
      fans.length,
  );
  return {
    fans,
    total,
    hasMore: Boolean(value.hasMore) || offset + fans.length < total,
  };
}
