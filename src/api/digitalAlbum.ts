import { normalizeSong, request } from "./client.ts";
import type { DigitalAlbum, DigitalAlbumRank, Song } from "./types.ts";

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj =>
  value && typeof value === "object" ? (value as Obj) : {};
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

export function normalizeDigitalAlbum(raw: unknown): DigitalAlbum | null {
  const row = obj(raw);
  const value = obj(row.album ?? row.product ?? row.albumProduct ?? raw);
  const id = Number(
    value.id ??
      value.albumId ??
      value.productId ??
      value.resourceId ??
      row.albumId ??
      row.productId ??
      0,
  );
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const artists = arr(value.artists ?? row.artists)
    .map((artist) => String(obj(artist).name ?? ""))
    .filter(Boolean);
  const artistName = [
    value.artistName,
    typeof value.artist === "string" ? value.artist : obj(value.artist).name,
    value.creatorName,
    row.artistName,
    artists.join(" / "),
  ]
    .map((item) => String(item ?? ""))
    .find(Boolean) ?? "";
  return {
    id,
    name: String(
      value.name ?? value.albumName ?? value.productName ?? row.albumName ?? "数字专辑",
    ),
    artistName,
    coverUrl: String(
      value.picUrl ??
        value.coverUrl ??
        value.coverImgUrl ??
        value.cover ??
        row.coverUrl ??
        "",
    ),
    description: String(value.description ?? value.desc ?? ""),
    price: Number(value.price ?? value.amount ?? value.originPrice ?? 0),
    sales: Number(value.sales ?? value.salesCount ?? value.saleCount ?? 0),
    purchased: Boolean(
      value.purchased ?? value.owned ?? value.isBought ?? false,
    ),
    songs: arr(value.songs ?? value.trackList ?? value.tracks)
      .map(normalizeSong)
      .filter((item): item is Song => item !== null),
  };
}

export async function getDigitalAlbumDetail(
  id: number,
): Promise<DigitalAlbum | null> {
  const response = await request<Obj>("/digitalAlbum/detail", { id });
  return normalizeDigitalAlbum(response.data ?? response.result ?? response);
}

export type DigitalAlbumSalesPeriod = "daily" | "week" | "year" | "total";

export type DigitalAlbumStyleArea = "Z_H" | "E_A" | "KR" | "JP";

export async function getDigitalAlbumStyleLibrary(
  area: DigitalAlbumStyleArea = "Z_H",
  limit = 30,
  offset = 0,
): Promise<DigitalAlbum[]> {
  const response = await request<Obj>("/album/list/style", { area, limit, offset }, false);
  const value = obj(response.data ?? response.result ?? response);
  return arr(value.albums ?? value.list ?? value.records ?? response.data ?? response)
    .map(normalizeDigitalAlbum)
    .filter((item): item is DigitalAlbum => item !== null);
}

export async function getDigitalAlbumSalesBoard(
  period: DigitalAlbumSalesPeriod = "daily",
  year?: number,
  albumType: 0 | 1 = 0,
): Promise<DigitalAlbumRank[]> {
  const response = await request<Obj>(
    "/album/songsaleboard",
    { type: period, year: period === "year" ? year : undefined, albumType },
    false,
  );
  const value = obj(response.data ?? response.result ?? response);
  return arr(value.list ?? value.albums ?? value.records ?? value.data ?? response.data ?? response)
    .map((raw, index) => {
      const album = normalizeDigitalAlbum(obj(raw).album ?? raw);
      if (!album) return null;
      const value = obj(raw);
      return {
        ...album,
        rank: Number(value.rank ?? value.position ?? index + 1),
        score: Number(value.score ?? value.sales ?? album.sales),
      } satisfies DigitalAlbumRank;
    })
    .filter((item): item is DigitalAlbumRank => item !== null);
}

export async function getDigitalAlbumSales(
  ids: number[],
): Promise<Record<number, number>> {
  if (!ids.length) return {};
  const response = await request<Obj>("/digitalAlbum/sales", {
    ids: ids.join(","),
  });
  const value = obj(response.data ?? response.result ?? response);
  const result: Record<number, number> = {};
  for (const item of arr(value.list ?? value.records ?? value)) {
    const row = obj(item);
    const id = Number(row.id ?? row.albumId ?? 0);
    if (id > 0) result[id] = Number(row.sales ?? row.salesCount ?? 0);
  }
  return result;
}

export async function getPurchasedDigitalAlbums(
  limit = 30,
  offset = 0,
): Promise<DigitalAlbum[]> {
  const response = await request<Obj>("/digitalAlbum/purchased", {
    limit,
    offset,
  });
  const value = obj(response.data ?? response.result ?? response);
  return arr(
    value.paidAlbums ??
      value.albums ??
      value.list ??
      response.paidAlbums ??
      response.data ??
      response,
  )
    .map(normalizeDigitalAlbum)
    .filter((item): item is DigitalAlbum => item !== null);
}

export async function orderDigitalAlbum(input: {
  id: number;
  payment: "balance" | "alipay" | "wxpay";
  quantity?: number;
}): Promise<Obj> {
  return request<Obj>(
    "/digitalAlbum/ordering",
    { id: input.id, payment: input.payment, quantity: input.quantity ?? 1 },
    false,
    { method: "POST" },
  );
}
