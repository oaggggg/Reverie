import { normalizeSong, request } from "./client.ts";
import type {
  ArtistInfo,
  ChartCity,
  ChartSummary,
  DimensionChartDetail,
  Song,
} from "./types.ts";

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj =>
  value && typeof value === "object" ? (value as Obj) : {};
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

function firstArray(response: Obj, ...keys: string[]): unknown[] {
  const candidates = [response, obj(response.data), obj(response.result)];
  for (const candidate of candidates) {
    for (const key of keys) {
      if (Array.isArray(candidate[key])) return candidate[key] as unknown[];
    }
  }
  return Array.isArray(response.data) ? response.data : [];
}

function normalizeChart(raw: unknown): ChartSummary | null {
  const value = obj(raw);
  const id = Number(value.id ?? value.chartId ?? 0);
  if (!id) return null;
  return {
    id,
    name: String(value.name ?? value.title ?? "音乐榜单"),
    coverUrl: String(value.coverImgUrl ?? value.cover ?? value.picUrl ?? ""),
    updateFrequency: String(
      value.updateFrequency ??
        value.updateFrequencyText ??
        value.frequency ??
        "",
    ),
    description: String(value.description ?? value.desc ?? ""),
    trackCount: Number(value.trackCount ?? value.songCount ?? 0),
  };
}

export async function getChartSummaries(): Promise<ChartSummary[]> {
  const response = await request<Obj>("/toplist/detail", {}, false);
  return arr(response.list ?? response.data ?? response.result)
    .map(normalizeChart)
    .filter((item): item is ChartSummary => item !== null);
}

export async function getChartSummariesV2(): Promise<ChartSummary[]> {
  const response = await request<Obj>("/toplist/detail/v2", {}, false);
  const value = obj(response.data ?? response.result ?? response);
  return firstArray(value, "list", "charts", "rankings", "data")
    .map(normalizeChart)
    .filter((item): item is ChartSummary => item !== null);
}

export async function getChartSongs(id: number): Promise<Song[]> {
  if (!id) return [];
  const response = await request<Obj>("/top/list", { id }, false);
  const playlist = obj(response.playlist ?? response.data);
  const rows = arr(playlist.tracks ?? response.tracks ?? response.data);
  return rows
    .map((raw) => normalizeSong(obj(raw).song ?? raw))
    .filter((song): song is Song => song !== null);
}

export async function getArtistToplist(type = 1): Promise<ArtistInfo[]> {
  const response = await request<Obj>("/toplist/artist", { type }, false);
  // 该接口实际形状为 {list: {artists: [...]}}，artists 嵌套在 list 下。
  const value = obj(
    response.data ?? response.result ?? response.list ?? response,
  );
  return firstArray(value, "artists", "list", "data", "records")
    .map((raw) => {
      const item = obj(raw);
      const artist = obj(item.artist);
      return {
        id: Number(item.id ?? item.artistId ?? artist.id ?? 0),
        name: String(item.name ?? item.artistName ?? artist.name ?? "未知歌手"),
        picUrl: String(
          item.picUrl ?? item.img1v1Url ?? item.cover ?? artist.picUrl ?? "",
        ),
        alias: arr(item.alias ?? artist.alias)
          .map(String)
          .filter(Boolean),
        briefDesc: String(item.briefDesc ?? artist.briefDesc ?? ""),
        followed: Boolean(item.followed ?? item.follow ?? false),
        musicSize: Number(item.musicSize ?? artist.musicSize ?? 0),
        albumSize: Number(item.albumSize ?? artist.albumSize ?? 0),
      } satisfies ArtistInfo;
    })
    .filter((item) => item.id > 0);
}

function normalizeCity(raw: unknown, parentId?: string): ChartCity | null {
  const value = obj(raw);
  const id = String(
    value.id ?? value.code ?? value.cityCode ?? value.value ?? "",
  ).trim();
  const name = String(value.name ?? value.cityName ?? value.label ?? "").trim();
  if (!id || !name) return null;
  const children = firstArray(value, "children", "sub", "items", "list")
    .map((item) => normalizeCity(item, id))
    .filter((item): item is ChartCity => item !== null);
  return { id, name, parentId, children };
}

export async function getChartCities(bizCode?: "chart"): Promise<ChartCity[]> {
  const response = await request<Obj>("/lbs/city/code", { bizCode }, false);
  return firstArray(response, "cities", "list", "data", "children")
    .map((item) => normalizeCity(item))
    .filter((item): item is ChartCity => item !== null);
}

export interface DimensionChartQuery {
  chartCode: "CITY_SONG_CHART" | "CITY_STYLE_SONG_CHART";
  targetId: string;
  targetType: "CITY" | "CITY_STYLE";
}

export async function getDimensionChartDetail(
  query: DimensionChartQuery,
): Promise<DimensionChartDetail> {
  const response = await request<Obj>("/chart/detail", { ...query }, false);
  const value = obj(response.data ?? response.result ?? response);
  return {
    chartCode: query.chartCode,
    targetId: query.targetId,
    targetType: query.targetType,
    name: String(value.name ?? value.title ?? value.chartName ?? "城市榜"),
    description: String(value.description ?? value.desc ?? ""),
    updateTime: Number(
      value.updateTime ?? value.update_time ?? value.time ?? 0,
    ),
    songCount: Number(value.songCount ?? value.trackCount ?? value.total ?? 0),
  };
}

export async function getDimensionChartSongs(
  query: DimensionChartQuery,
): Promise<Song[]> {
  const response = await request<Obj>(
    "/chart/song/detail",
    { ...query },
    false,
  );
  return firstArray(response, "songs", "list", "data", "records")
    .map((raw) => normalizeSong(obj(raw).song ?? raw))
    .filter((song): song is Song => song !== null);
}
