import { request } from "./client.ts";

export interface PlaybackReportInput {
  id: number;
  sourceId?: number;
  time?: number;
  source?: string;
}

/** Notify NetEase that a track has started playing. */
export async function reportScrobble(
  input: PlaybackReportInput,
): Promise<void> {
  if (!Number.isSafeInteger(input.id) || input.id <= 0) return;
  await request(
    "/scrobble",
    {
      id: input.id,
      sourceid: input.sourceId,
      time: Math.max(0, Math.floor(input.time ?? 0)),
    },
    false,
  );
}

/** Record a playback lifecycle event through the upstream weblog endpoint. */
export async function reportWeblog(
  input: PlaybackReportInput & { action?: string; end?: string },
): Promise<void> {
  if (!Number.isSafeInteger(input.id) || input.id <= 0) return;
  const event = {
    action: input.action ?? "play",
    json: {
      download: 0,
      end: input.end ?? "playend",
      id: input.id,
      sourceId: input.sourceId,
      time: Math.max(0, Math.floor(input.time ?? 0)),
      type: "song",
      wifi: 0,
      source: input.source ?? "list",
      mainsite: 1,
      content: "",
    },
  };
  await request("/weblog", { data: JSON.stringify(event) }, false);
}
