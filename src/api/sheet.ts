import { request } from "./client.ts";
import type { SongSheet } from "./types.ts";

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj =>
  value && typeof value === "object" ? (value as Obj) : {};

function normalize(raw: unknown, index: number): SongSheet | null {
  const value = obj(raw);
  const id = String(value.id ?? value.sheetId ?? value.musicId ?? `${index}`);
  const name = String(value.name ?? value.title ?? value.sheetName ?? "乐谱");
  if (!id || !name) return null;
  return {
    id,
    name,
    type: String(value.type ?? value.format ?? value.sheetType ?? "乐谱"),
    coverUrl: String(value.coverUrl ?? value.picUrl ?? value.imageUrl ?? ""),
    previewUrl: String(value.previewUrl ?? value.url ?? value.image ?? ""),
    description: String(value.description ?? value.desc ?? value.content ?? ""),
  };
}

function list(response: Obj): unknown[] {
  const candidates = [response, obj(response.data), obj(response.result)];
  for (const candidate of candidates) {
    for (const key of ["sheets", "list", "data", "resources", "records"]) {
      if (Array.isArray(candidate[key])) return candidate[key] as unknown[];
    }
  }
  return Array.isArray(response.data) ? response.data : [];
}

export async function getSongSheets(songId: number): Promise<SongSheet[]> {
  if (!songId) return [];
  const response = await request<Obj>("/sheet/list", { id: songId }, false);
  const seen = new Set<string>();
  return list(response)
    .map(normalize)
    .filter((item): item is SongSheet => item !== null)
    .filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)));
}

export async function getSongSheetPreview(
  songId: number,
): Promise<SongSheet | null> {
  if (!songId) return null;
  const response = await request<Obj>("/sheet/preview", { id: songId }, false);
  const value = obj(response.data ?? response.result ?? response);
  return normalize(value.sheet ?? value.preview ?? value, 0);
}
