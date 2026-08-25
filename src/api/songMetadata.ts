import { request } from "./client.ts";
import type {
  SongChorusInfo,
  SongCreatorInfo,
  SongMetadata,
  SongMusicDetail,
} from "./types.ts";

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj =>
  value && typeof value === "object" ? (value as Obj) : {};
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

function normalizeMusicDetail(
  raw: unknown,
  songId: number,
): SongMusicDetail | undefined {
  const value = obj(raw);
  const data = obj(value.data ?? value.result ?? value);
  const row = obj(Array.isArray(value.data) ? value.data[0] : data);
  const bitrate = Number(row.bitrate ?? row.br ?? row.bitRate ?? 0);
  const size = Number(row.size ?? row.fileSize ?? 0);
  const level = String(row.level ?? row.quality ?? "");
  if (!bitrate && !size && !level) return undefined;
  return {
    songId,
    level,
    bitrate,
    format: String(row.format ?? row.type ?? ""),
    size,
    url: String(row.url ?? "") || undefined,
  };
}

export async function getSongMetadata(id: number): Promise<SongMetadata> {
  const [wiki, creators, chorus, musicDetail, redCount] =
    await Promise.allSettled([
      request<Obj>("/song/wiki/summary", { id }, false),
      request<Obj>("/song/creators", { songId: id }, false),
      request<Obj>("/song/chorus", { ids: JSON.stringify([id]) }, false),
      request<Obj>("/song/music/detail", { id }, false),
      request<Obj>("/song/red/count", { id }, false),
    ]);
  const wikiValue =
    wiki.status === "fulfilled" ? obj(wiki.value.data ?? wiki.value) : {};
  const summary = String(
    wikiValue.summary ??
      wikiValue.description ??
      wikiValue.desc ??
      obj(wikiValue.block).summary ??
      "",
  );
  const creatorValue = creators.status === "fulfilled" ? creators.value : {};
  const creatorList = arr(
    creatorValue.creators ?? creatorValue.data ?? creatorValue.list,
  );
  const creatorItems = creatorList
    .map((raw) => {
      const value = obj(raw);
      return {
        userId: Number(value.userId ?? value.id ?? 0),
        name: String(value.name ?? value.nickname ?? value.creatorName ?? ""),
        role: String(value.role ?? value.type ?? value.job ?? ""),
      } satisfies SongCreatorInfo;
    })
    .filter((item) => item.name);
  const chorusValue = chorus.status === "fulfilled" ? chorus.value : {};
  const chorusList = arr(
    chorusValue.data ?? chorusValue.chorus ?? chorusValue.list,
  );
  const chorusItems = chorusList
    .map((raw) => {
      const value = obj(raw);
      return {
        start: Number(value.start ?? value.startTime ?? 0),
        end: Number(value.end ?? value.endTime ?? 0),
      } satisfies SongChorusInfo;
    })
    .filter((item) => item.end > item.start);
  const detail =
    musicDetail.status === "fulfilled"
      ? normalizeMusicDetail(musicDetail.value, id)
      : undefined;
  const redValue =
    redCount.status === "fulfilled"
      ? obj(redCount.value.data ?? redCount.value.result ?? redCount.value)
      : {};
  const red = Number(
    redValue.count ??
      redValue.redCount ??
      redValue.total ??
      (redCount.status === "fulfilled" ? redCount.value.count : 0) ??
      0,
  );
  return {
    summary,
    creators: creatorItems,
    chorus: chorusItems,
    musicDetail: detail,
    redCount: Number.isFinite(red) ? red : 0,
  };
}
