import { normalizeSong, request } from "./client.ts";
import type { Song } from "./types.ts";

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Obj)
    : {};
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

export async function matchAudioFingerprint(
  audioFP: string,
  duration: number,
): Promise<Song[]> {
  if (!audioFP.trim() || duration <= 0) return [];
  const response = await request<Obj>(
    "/audio/match",
    { audioFP, duration },
    false,
  );
  const value = obj(response.data ?? response.result ?? response);
  return arr(
    value.result ?? value.songs ?? value.matches ?? response.data ?? response,
  )
    .map((raw) => normalizeSong(obj(raw).song ?? obj(raw).track ?? raw))
    .filter((song): song is Song => song !== null);
}
